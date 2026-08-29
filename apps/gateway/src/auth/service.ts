import type {
  ApiErrorCode,
  AccountDeletionChallengeRequest,
  AccountDeletionGrantResponse,
  AccountDeletionRequest,
  AuthSessionResponse,
  EmailChallengeAccepted,
  EmailChallengeRequest,
  EmailChallengeVerifyRequest,
  LogoutSessionRequest,
  RefreshSessionRequest,
} from "@cave/contracts";

import {
  createNumericCode,
  createOpaqueToken,
  digestLowEntropySecret,
  digestOpaqueToken,
  normalizeEmail,
  secureEqual,
} from "./crypto";
import type { AuthEmailSender } from "./email-sender";
import type { AuthAccount, AuthRepository, AuthSession } from "./repository";

const CHALLENGE_TTL_MS = 10 * 60_000;
const ACCESS_TTL_MS = 15 * 60_000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60_000;
const PREVIOUS_REFRESH_GRACE_MS = 30_000;
const DELETION_GRANT_TTL_MS = 5 * 60_000;
const DELETION_RECEIPT_TTL_MS = 24 * 60 * 60_000;
const CHALLENGE_RATE_WINDOW_MS = 15 * 60_000;

type VersionedKey = Readonly<{ version: number; value: string }>;

type Dependencies = {
  repository: AuthRepository;
  emailSender: AuthEmailSender;
  emailLookupKeys: readonly VersionedKey[];
  otpKeys: readonly VersionedKey[];
  now?(): number;
  createId?(): string;
  createCode?(): string;
  createToken?(kind: "access" | "refresh" | "deletionGrant"): string;
};

export class AuthServiceError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly status: number,
    readonly retryAfterSeconds?: number,
  ) {
    super("Authentication request failed");
    this.name = "AuthServiceError";
  }
}

function requiredCurrent(keys: readonly VersionedKey[], name: string): VersionedKey {
  const key = keys[0];
  if (key === undefined || key.value.trim().length === 0) throw new Error(`${name}-key-required`);
  return key;
}

function findKey(keys: readonly VersionedKey[], version: number): VersionedKey | undefined {
  return keys.find((key) => key.version === version);
}

function validateKeyRing(keys: readonly VersionedKey[], name: string): void {
  const versions = new Set<number>();
  for (const key of keys) {
    if (!Number.isInteger(key.version) || key.version < 1 || versions.has(key.version)) {
      throw new Error(`${name}-key-version-invalid`);
    }
    if (new TextEncoder().encode(key.value).byteLength < 32) throw new Error(`${name}-key-too-short`);
    versions.add(key.version);
  }
}

export function createAuthService({
  repository,
  emailSender,
  emailLookupKeys,
  otpKeys,
  now = Date.now,
  createId = () => crypto.randomUUID(),
  createCode = createNumericCode,
  createToken = createOpaqueToken,
}: Dependencies) {
  validateKeyRing(emailLookupKeys, "email-lookup");
  validateKeyRing(otpKeys, "otp");
  requiredCurrent(emailLookupKeys, "email-lookup");
  const currentOtpKey = requiredCurrent(otpKeys, "otp");
  const emailKeyValues = new Set(emailLookupKeys.map((key) => key.value));
  if (otpKeys.some((key) => emailKeyValues.has(key.value))) throw new Error("auth-key-reuse-forbidden");

  async function enforceChallengeRateLimit(
    purpose: "sign_in" | "account_delete",
    emailLookup: string,
    installationDigest: string,
  ): Promise<void> {
    const timestamp = now();
    const windowStartMs = Math.floor(timestamp / CHALLENGE_RATE_WINDOW_MS) * CHALLENGE_RATE_WINDOW_MS;
    const windowStartedAt = new Date(windowStartMs).toISOString();
    const expiresAt = new Date(windowStartMs + CHALLENGE_RATE_WINDOW_MS).toISOString();
    const retryAfterSeconds = Math.max(1, Math.ceil((windowStartMs + CHALLENGE_RATE_WINDOW_MS - timestamp) / 1000));
    const emailAllowed = await repository.consumeRateLimit({
      scope: `${purpose}:email`, keyDigest: emailLookup, windowStartedAt, expiresAt, limit: 3,
    });
    if (!emailAllowed) throw new AuthServiceError("RATE_LIMITED", 429, retryAfterSeconds);
    const installationAllowed = await repository.consumeRateLimit({
      scope: `${purpose}:installation`, keyDigest: installationDigest, windowStartedAt, expiresAt, limit: 5,
    });
    if (!installationAllowed) throw new AuthServiceError("RATE_LIMITED", 429, retryAfterSeconds);
  }

  async function createTokens(account: AuthAccount, requestId: string): Promise<{
    response: AuthSessionResponse;
    record: AuthSession;
  }> {
    const issuedAtMs = now();
    const issuedAt = new Date(issuedAtMs).toISOString();
    const accessToken = createToken("access");
    const refreshToken = createToken("refresh");
    const accessExpiresAt = new Date(issuedAtMs + ACCESS_TTL_MS).toISOString();
    const refreshExpiresAt = new Date(issuedAtMs + REFRESH_TTL_MS).toISOString();
    return {
      response: {
        contractVersion: "1",
        requestId,
        account: { id: account.id },
        session: { accessToken, accessExpiresAt, refreshToken, refreshExpiresAt },
      },
      record: {
        id: createId(),
        accountId: account.id,
        accessDigest: await digestOpaqueToken(accessToken),
        accessExpiresAt,
        refreshDigest: await digestOpaqueToken(refreshToken),
        refreshExpiresAt,
        createdAt: issuedAt,
        lastSeenAt: issuedAt,
      },
    };
  }

  return {
    async requestEmailChallenge(input: EmailChallengeRequest): Promise<EmailChallengeAccepted> {
      const createdAtMs = now();
      const createdAt = new Date(createdAtMs).toISOString();
      const normalizedEmail = normalizeEmail(input.email);
      const challengeId = createId();
      const code = createCode();
      const emailLookups = await Promise.all(emailLookupKeys.map(async (key) => ({
        emailLookup: await digestLowEntropySecret(key.value, normalizedEmail),
        emailKeyVersion: key.version,
      })));
      const currentEmailLookup = emailLookups[0];
      if (currentEmailLookup === undefined) throw new Error("email-lookup-key-required");
      const existingAccount = await repository.findAccountByEmailLookups(emailLookups);
      const installationDigest = await digestOpaqueToken(input.installationToken);
      await enforceChallengeRateLimit("sign_in", currentEmailLookup.emailLookup, installationDigest);
      const codeDigest = await digestLowEntropySecret(currentOtpKey.value, `${challengeId}:${code}`);
      await repository.createChallenge({
        id: challengeId,
        purpose: "sign_in",
        emailLookup: currentEmailLookup.emailLookup,
        emailKeyVersion: currentEmailLookup.emailKeyVersion,
        ...(existingAccount === null ? {} : { accountId: existingAccount.id }),
        installationDigest,
        codeDigest,
        otpKeyVersion: currentOtpKey.version,
        expiresAt: new Date(createdAtMs + CHALLENGE_TTL_MS).toISOString(),
        attemptsRemaining: 5,
        createdAt,
      }, emailLookups);
      try {
        await emailSender.sendCode({
          to: normalizedEmail,
          code,
          purpose: "sign_in",
          expiresInMinutes: 10,
          idempotencyKey: `auth-code/${challengeId}`,
        });
      } catch {
        await repository.invalidateChallenge(challengeId, new Date(now()).toISOString());
        throw new AuthServiceError("AUTH_DELIVERY_UNAVAILABLE", 503);
      }
      return {
        contractVersion: "1",
        requestId: input.requestId,
        challengeId,
        expiresInSeconds: 600,
        resendAfterSeconds: 60,
      };
    },

    async verifyEmailChallenge(
      challengeId: string,
      input: EmailChallengeVerifyRequest,
    ): Promise<AuthSessionResponse> {
      const challenge = await repository.getChallenge(challengeId);
      if (
        challenge === null
        || challenge.purpose !== "sign_in"
        || challenge.consumedAt !== undefined
        || challenge.invalidatedAt !== undefined
      ) throw new AuthServiceError("AUTH_CHALLENGE_INVALID", 400);
      const nowIso = new Date(now()).toISOString();
      if (challenge.expiresAt < nowIso) throw new AuthServiceError("AUTH_CODE_EXPIRED", 400);
      const installationDigest = await digestOpaqueToken(input.installationToken);
      if (!secureEqual(challenge.installationDigest, installationDigest)) {
        throw new AuthServiceError("AUTH_CHALLENGE_INVALID", 400);
      }
      const otpKey = findKey(otpKeys, challenge.otpKeyVersion);
      if (otpKey === undefined) throw new AuthServiceError("AUTH_CHALLENGE_INVALID", 400);
      const suppliedDigest = await digestLowEntropySecret(otpKey.value, `${challengeId}:${input.code}`);
      if (!secureEqual(challenge.codeDigest, suppliedDigest)) {
        const remaining = await repository.recordFailedAttempt(challengeId, nowIso);
        throw new AuthServiceError(
          remaining === 0 ? "AUTH_TOO_MANY_ATTEMPTS" : "AUTH_INVALID_CODE",
          400,
        );
      }
      if (!await repository.consumeChallenge(challengeId, nowIso)) {
        throw new AuthServiceError("AUTH_CHALLENGE_INVALID", 400);
      }
      const migrated = challenge.accountId === undefined
        ? null
        : await repository.migrateAccountEmailLookup(challenge.accountId, {
          emailLookup: challenge.emailLookup,
          emailKeyVersion: challenge.emailKeyVersion,
        });
      const account = migrated ?? await repository.findOrCreateAccount({
          id: createId(),
          emailLookup: challenge.emailLookup,
          emailKeyVersion: challenge.emailKeyVersion,
          createdAt: nowIso,
        });
      const tokens = await createTokens(account, input.requestId);
      await repository.createSession(tokens.record);
      return tokens.response;
    },

    async refresh(input: RefreshSessionRequest): Promise<AuthSessionResponse> {
      const presentedDigest = await digestOpaqueToken(input.refreshToken);
      const existing = await repository.findSessionByRefreshDigest(presentedDigest);
      const nowMs = now();
      const nowIso = new Date(nowMs).toISOString();
      if (
        existing === null
        || existing.revokedAt !== undefined
        || existing.refreshExpiresAt < nowIso
      ) throw new AuthServiceError("AUTH_SESSION_EXPIRED", 401);
      const isCurrent = existing.refreshDigest === presentedDigest;
      const isPreviousWithinGrace = existing.previousRefreshDigest === presentedDigest
        && existing.previousRefreshValidUntil !== undefined
        && existing.previousRefreshValidUntil >= nowIso;
      if (!isCurrent) {
        if (!isPreviousWithinGrace) await repository.revokeSessionByRefreshDigest(presentedDigest, nowIso);
        throw new AuthServiceError("AUTH_SESSION_EXPIRED", 401);
      }
      const account: AuthAccount = {
        id: existing.accountId,
        emailLookup: "not-returned",
        emailKeyVersion: 0,
        createdAt: existing.createdAt,
      };
      const tokens = await createTokens(account, input.requestId);
      const rotated = await repository.rotateSession({
        sessionId: existing.id,
        presentedDigest,
        accessDigest: tokens.record.accessDigest,
        accessExpiresAt: tokens.record.accessExpiresAt,
        refreshDigest: tokens.record.refreshDigest,
        refreshExpiresAt: tokens.record.refreshExpiresAt,
        previousRefreshValidUntil: new Date(nowMs + PREVIOUS_REFRESH_GRACE_MS).toISOString(),
        now: nowIso,
      });
      if (rotated === null) throw new AuthServiceError("AUTH_SESSION_EXPIRED", 401);
      return tokens.response;
    },

    async logout(input: LogoutSessionRequest): Promise<void> {
      const digest = await digestOpaqueToken(input.refreshToken);
      await repository.revokeSessionByRefreshDigest(digest, new Date(now()).toISOString());
    },

    async requestAccountDeletionChallenge(
      accessToken: string,
      input: AccountDeletionChallengeRequest,
    ): Promise<EmailChallengeAccepted> {
      const nowMs = now();
      const nowIso = new Date(nowMs).toISOString();
      const accessDigest = await digestOpaqueToken(accessToken);
      const session = await repository.findSessionByAccessDigest(accessDigest);
      if (
        session === null
        || session.revokedAt !== undefined
        || session.accessExpiresAt < nowIso
      ) throw new AuthServiceError("AUTH_UNAUTHORIZED", 401);
      const account = await repository.findAccountById(session.accountId);
      const emailKey = account === null ? undefined : findKey(emailLookupKeys, account.emailKeyVersion);
      const normalizedEmail = normalizeEmail(input.email);
      const suppliedLookup = emailKey === undefined
        ? ""
        : await digestLowEntropySecret(emailKey.value, normalizedEmail);
      if (account === null || !secureEqual(account.emailLookup, suppliedLookup)) {
        throw new AuthServiceError("AUTH_REAUTH_REQUIRED", 401);
      }
      const challengeId = createId();
      const code = createCode();
      const codeDigest = await digestLowEntropySecret(currentOtpKey.value, `${challengeId}:${code}`);
      const installationDigest = await digestOpaqueToken(input.installationToken);
      await enforceChallengeRateLimit("account_delete", account.emailLookup, installationDigest);
      await repository.createChallenge({
        id: challengeId,
        accountId: account.id,
        purpose: "account_delete",
        emailLookup: account.emailLookup,
        emailKeyVersion: account.emailKeyVersion,
        installationDigest,
        codeDigest,
        otpKeyVersion: currentOtpKey.version,
        expiresAt: new Date(nowMs + CHALLENGE_TTL_MS).toISOString(),
        attemptsRemaining: 5,
        createdAt: nowIso,
      });
      try {
        await emailSender.sendCode({
          to: normalizedEmail,
          code,
          purpose: "account_delete",
          expiresInMinutes: 10,
          idempotencyKey: `auth-code/${challengeId}`,
        });
      } catch {
        await repository.invalidateChallenge(challengeId, new Date(now()).toISOString());
        throw new AuthServiceError("AUTH_DELIVERY_UNAVAILABLE", 503);
      }
      return {
        contractVersion: "1",
        requestId: input.requestId,
        challengeId,
        expiresInSeconds: 600,
        resendAfterSeconds: 60,
      };
    },

    async verifyAccountDeletionChallenge(
      challengeId: string,
      input: EmailChallengeVerifyRequest,
    ): Promise<AccountDeletionGrantResponse> {
      const challenge = await repository.getChallenge(challengeId);
      if (
        challenge === null
        || challenge.purpose !== "account_delete"
        || challenge.accountId === undefined
        || challenge.consumedAt !== undefined
        || challenge.invalidatedAt !== undefined
      ) throw new AuthServiceError("AUTH_CHALLENGE_INVALID", 400);
      const nowMs = now();
      const nowIso = new Date(nowMs).toISOString();
      if (challenge.expiresAt < nowIso) throw new AuthServiceError("AUTH_CODE_EXPIRED", 400);
      if (!secureEqual(challenge.installationDigest, await digestOpaqueToken(input.installationToken))) {
        throw new AuthServiceError("AUTH_CHALLENGE_INVALID", 400);
      }
      const otpKey = findKey(otpKeys, challenge.otpKeyVersion);
      const suppliedDigest = otpKey === undefined
        ? ""
        : await digestLowEntropySecret(otpKey.value, `${challengeId}:${input.code}`);
      if (otpKey === undefined || !secureEqual(challenge.codeDigest, suppliedDigest)) {
        const remaining = await repository.recordFailedAttempt(challengeId, nowIso);
        throw new AuthServiceError(
          remaining === 0 ? "AUTH_TOO_MANY_ATTEMPTS" : "AUTH_INVALID_CODE",
          400,
        );
      }
      if (!await repository.consumeChallenge(challengeId, nowIso)) {
        throw new AuthServiceError("AUTH_CHALLENGE_INVALID", 400);
      }
      const deletionGrant = createToken("deletionGrant");
      await repository.createDeletionGrant({
        id: createId(),
        accountId: challenge.accountId,
        grantDigest: await digestOpaqueToken(deletionGrant),
        expiresAt: new Date(nowMs + DELETION_GRANT_TTL_MS).toISOString(),
        createdAt: nowIso,
      });
      return {
        contractVersion: "1",
        requestId: input.requestId,
        deletionGrant,
        expiresInSeconds: 300,
      };
    },

    async deleteAccount(input: AccountDeletionRequest): Promise<void> {
      const nowMs = now();
      const grantDigest = await digestOpaqueToken(input.deletionGrant);
      const result = await repository.deleteAccountWithGrant({
        grantDigest,
        idempotencyDigest: await digestLowEntropySecret(
          currentOtpKey.value,
          `delete:${grantDigest}:${input.idempotencyKey}`,
        ),
        now: new Date(nowMs).toISOString(),
        receiptExpiresAt: new Date(nowMs + DELETION_RECEIPT_TTL_MS).toISOString(),
      });
      if (result === "invalid") throw new AuthServiceError("AUTH_REAUTH_REQUIRED", 401);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;

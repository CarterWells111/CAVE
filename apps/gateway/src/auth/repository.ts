export type AuthChallengePurpose = "sign_in" | "account_delete";

export type AuthChallenge = {
  id: string;
  purpose: AuthChallengePurpose;
  emailLookup: string;
  emailKeyVersion: number;
  installationDigest: string;
  codeDigest: string;
  otpKeyVersion: number;
  expiresAt: string;
  attemptsRemaining: number;
  createdAt: string;
  accountId?: string;
  consumedAt?: string;
  invalidatedAt?: string;
};

export type AuthDeletionGrant = {
  id: string;
  accountId: string;
  grantDigest: string;
  expiresAt: string;
  createdAt: string;
  consumedAt?: string;
};

export type DeleteAccountResult = "deleted" | "replayed" | "invalid";

export type AuthAccount = {
  id: string;
  emailLookup: string;
  emailKeyVersion: number;
  createdAt: string;
};

export type AuthEmailLookup = Pick<AuthAccount, "emailLookup" | "emailKeyVersion">;

export type AuthSession = {
  id: string;
  accountId: string;
  accessDigest: string;
  accessExpiresAt: string;
  refreshDigest: string;
  previousRefreshDigest?: string;
  previousRefreshValidUntil?: string;
  refreshExpiresAt: string;
  createdAt: string;
  lastSeenAt: string;
  revokedAt?: string;
};

export interface AuthRepository {
  consumeRateLimit(input: {
    scope: string;
    keyDigest: string;
    windowStartedAt: string;
    expiresAt: string;
    limit: number;
  }): Promise<boolean>;
  createChallenge(
    challenge: AuthChallenge,
    invalidateEmailLookups?: readonly AuthEmailLookup[],
  ): Promise<void>;
  getChallenge(id: string): Promise<AuthChallenge | null>;
  listChallenges(): Promise<AuthChallenge[]>;
  invalidateChallenge(id: string, at: string): Promise<void>;
  recordFailedAttempt(id: string, at: string): Promise<number>;
  consumeChallenge(id: string, at: string): Promise<boolean>;
  findOrCreateAccount(input: AuthAccount): Promise<AuthAccount>;
  findAccountByEmailLookups(candidates: readonly AuthEmailLookup[]): Promise<AuthAccount | null>;
  migrateAccountEmailLookup(accountId: string, lookup: AuthEmailLookup): Promise<AuthAccount | null>;
  findAccountById(id: string): Promise<AuthAccount | null>;
  createSession(session: AuthSession): Promise<void>;
  findSessionByAccessDigest(digest: string): Promise<AuthSession | null>;
  findSessionByRefreshDigest(digest: string): Promise<AuthSession | null>;
  rotateSession(input: {
    sessionId: string;
    presentedDigest: string;
    accessDigest: string;
    accessExpiresAt: string;
    refreshDigest: string;
    refreshExpiresAt: string;
    previousRefreshValidUntil: string;
    now: string;
  }): Promise<AuthSession | null>;
  revokeSessionByRefreshDigest(digest: string, at: string): Promise<void>;
  createDeletionGrant(grant: AuthDeletionGrant): Promise<void>;
  deleteAccountWithGrant(input: {
    grantDigest: string;
    idempotencyDigest: string;
    now: string;
    receiptExpiresAt: string;
  }): Promise<DeleteAccountResult>;
}

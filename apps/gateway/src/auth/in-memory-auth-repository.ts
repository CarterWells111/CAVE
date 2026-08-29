import type {
  AuthAccount,
  AuthChallenge,
  AuthDeletionGrant,
  AuthEmailLookup,
  AuthRepository,
  AuthSession,
  DeleteAccountResult,
} from "./repository";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryAuthRepository implements AuthRepository {
  private readonly challenges = new Map<string, AuthChallenge>();
  private readonly accounts = new Map<string, AuthAccount>();
  private readonly sessions = new Map<string, AuthSession>();
  private readonly deletionGrants = new Map<string, AuthDeletionGrant>();
  private readonly deletionReceipts = new Map<string, { grantDigest: string; expiresAt: string }>();
  private readonly rateBuckets = new Map<string, number>();

  async consumeRateLimit(input: {
    scope: string; keyDigest: string; windowStartedAt: string; expiresAt: string; limit: number;
  }): Promise<boolean> {
    const key = `${input.scope}:${input.keyDigest}:${input.windowStartedAt}`;
    const count = this.rateBuckets.get(key) ?? 0;
    if (count >= input.limit) return false;
    this.rateBuckets.set(key, count + 1);
    return true;
  }

  async createChallenge(
    challenge: AuthChallenge,
    invalidateEmailLookups: readonly AuthEmailLookup[] = [challenge],
  ): Promise<void> {
    const lookupKeys = new Set(invalidateEmailLookups.map(
      (lookup) => `${lookup.emailKeyVersion}:${lookup.emailLookup}`,
    ));
    for (const current of this.challenges.values()) {
      if (
        lookupKeys.has(`${current.emailKeyVersion}:${current.emailLookup}`)
        && current.purpose === challenge.purpose
        && current.consumedAt === undefined
        && current.invalidatedAt === undefined
      ) {
        current.invalidatedAt = challenge.createdAt;
      }
    }
    this.challenges.set(challenge.id, clone(challenge));
  }

  async getChallenge(id: string): Promise<AuthChallenge | null> {
    const value = this.challenges.get(id);
    return value === undefined ? null : clone(value);
  }

  async listChallenges(): Promise<AuthChallenge[]> {
    return [...this.challenges.values()].map(clone);
  }

  async invalidateChallenge(id: string, at: string): Promise<void> {
    const value = this.challenges.get(id);
    if (value !== undefined && value.invalidatedAt === undefined) value.invalidatedAt = at;
  }

  async recordFailedAttempt(id: string, at: string): Promise<number> {
    const value = this.challenges.get(id);
    if (value === undefined || value.consumedAt !== undefined || value.invalidatedAt !== undefined) return 0;
    value.attemptsRemaining = Math.max(0, value.attemptsRemaining - 1);
    if (value.attemptsRemaining === 0) value.invalidatedAt = at;
    return value.attemptsRemaining;
  }

  async consumeChallenge(id: string, at: string): Promise<boolean> {
    const value = this.challenges.get(id);
    if (value === undefined || value.consumedAt !== undefined || value.invalidatedAt !== undefined) return false;
    value.consumedAt = at;
    return true;
  }

  async findOrCreateAccount(input: AuthAccount): Promise<AuthAccount> {
    const key = `${input.emailKeyVersion}:${input.emailLookup}`;
    const existing = this.accounts.get(key);
    if (existing !== undefined) return clone(existing);
    this.accounts.set(key, clone(input));
    return clone(input);
  }

  async findAccountByEmailLookups(candidates: readonly AuthEmailLookup[]): Promise<AuthAccount | null> {
    for (const candidate of candidates) {
      const account = this.accounts.get(`${candidate.emailKeyVersion}:${candidate.emailLookup}`);
      if (account !== undefined) return clone(account);
    }
    return null;
  }

  async migrateAccountEmailLookup(
    accountId: string,
    lookup: AuthEmailLookup,
  ): Promise<AuthAccount | null> {
    for (const [key, account] of this.accounts) {
      if (account.id !== accountId) continue;
      this.accounts.delete(key);
      account.emailLookup = lookup.emailLookup;
      account.emailKeyVersion = lookup.emailKeyVersion;
      this.accounts.set(`${lookup.emailKeyVersion}:${lookup.emailLookup}`, account);
      return clone(account);
    }
    return null;
  }

  async findAccountById(id: string): Promise<AuthAccount | null> {
    const account = [...this.accounts.values()].find((candidate) => candidate.id === id);
    return account === undefined ? null : clone(account);
  }

  async createSession(session: AuthSession): Promise<void> {
    this.sessions.set(session.id, clone(session));
  }

  async findSessionByAccessDigest(digest: string): Promise<AuthSession | null> {
    const session = [...this.sessions.values()].find((candidate) => candidate.accessDigest === digest);
    return session === undefined ? null : clone(session);
  }

  async findSessionByRefreshDigest(digest: string): Promise<AuthSession | null> {
    const session = [...this.sessions.values()].find((candidate) => (
      candidate.refreshDigest === digest || candidate.previousRefreshDigest === digest
    ));
    return session === undefined ? null : clone(session);
  }

  async rotateSession(input: {
    sessionId: string;
    presentedDigest: string;
    accessDigest: string;
    accessExpiresAt: string;
    refreshDigest: string;
    refreshExpiresAt: string;
    previousRefreshValidUntil: string;
    now: string;
  }): Promise<AuthSession | null> {
    const session = this.sessions.get(input.sessionId);
    if (session === undefined || session.revokedAt !== undefined) return null;
    if (session.refreshDigest !== input.presentedDigest) return null;
    session.previousRefreshDigest = session.refreshDigest;
    session.previousRefreshValidUntil = input.previousRefreshValidUntil;
    session.refreshDigest = input.refreshDigest;
    session.refreshExpiresAt = input.refreshExpiresAt;
    session.accessDigest = input.accessDigest;
    session.accessExpiresAt = input.accessExpiresAt;
    session.lastSeenAt = input.now;
    return clone(session);
  }

  async revokeSessionByRefreshDigest(digest: string, at: string): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.refreshDigest === digest || session.previousRefreshDigest === digest) {
        session.revokedAt ??= at;
      }
    }
  }


  async createDeletionGrant(grant: AuthDeletionGrant): Promise<void> {
    this.deletionGrants.set(grant.grantDigest, clone(grant));
  }

  async deleteAccountWithGrant(input: {
    grantDigest: string;
    idempotencyDigest: string;
    now: string;
    receiptExpiresAt: string;
  }): Promise<DeleteAccountResult> {
    const receipt = this.deletionReceipts.get(input.idempotencyDigest);
    if (
      receipt?.grantDigest === input.grantDigest
      && receipt.expiresAt >= input.now
    ) return "replayed";
    if (receipt !== undefined && receipt.expiresAt >= input.now) return "invalid";
    const grant = this.deletionGrants.get(input.grantDigest);
    if (grant === undefined || grant.consumedAt !== undefined || grant.expiresAt < input.now) return "invalid";
    grant.consumedAt = input.now;
    this.deletionReceipts.set(input.idempotencyDigest, {
      grantDigest: input.grantDigest,
      expiresAt: input.receiptExpiresAt,
    });
    for (const [key, account] of this.accounts) {
      if (account.id === grant.accountId) this.accounts.delete(key);
    }
    for (const [id, session] of this.sessions) {
      if (session.accountId === grant.accountId) this.sessions.delete(id);
    }
    return "deleted";
  }
}

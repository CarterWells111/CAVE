import type {
  AuthAccount,
  AuthChallenge,
  AuthChallengePurpose,
  AuthDeletionGrant,
  AuthEmailLookup,
  AuthRepository,
  AuthSession,
  DeleteAccountResult,
} from "./repository";

type ChallengeRow = {
  id: string; purpose: AuthChallengePurpose; email_lookup: string; email_lookup_version: number;
  account_id: string | null;
  installation_digest: string; code_digest: string; otp_key_version: number; expires_at: string;
  attempts_remaining: number; created_at: string; consumed_at: string | null; invalidated_at: string | null;
};
type AccountRow = { id: string; email_lookup: string; email_lookup_version: number; created_at: string };
type SessionRow = {
  id: string; account_id: string; access_digest: string; access_expires_at: string;
  refresh_digest: string; previous_refresh_digest: string | null; previous_refresh_valid_until: string | null;
  refresh_expires_at: string; created_at: string; last_seen_at: string; revoked_at: string | null;
};

function challengeFrom(row: ChallengeRow): AuthChallenge {
  return {
    id: row.id,
    purpose: row.purpose,
    emailLookup: row.email_lookup,
    emailKeyVersion: row.email_lookup_version,
    installationDigest: row.installation_digest,
    codeDigest: row.code_digest,
    otpKeyVersion: row.otp_key_version,
    expiresAt: row.expires_at,
    attemptsRemaining: row.attempts_remaining,
    createdAt: row.created_at,
    ...(row.account_id === null ? {} : { accountId: row.account_id }),
    ...(row.consumed_at === null ? {} : { consumedAt: row.consumed_at }),
    ...(row.invalidated_at === null ? {} : { invalidatedAt: row.invalidated_at }),
  };
}

function accountFrom(row: AccountRow): AuthAccount {
  return { id: row.id, emailLookup: row.email_lookup, emailKeyVersion: row.email_lookup_version, createdAt: row.created_at };
}

function sessionFrom(row: SessionRow): AuthSession {
  return {
    id: row.id,
    accountId: row.account_id,
    accessDigest: row.access_digest,
    accessExpiresAt: row.access_expires_at,
    refreshDigest: row.refresh_digest,
    ...(row.previous_refresh_digest === null ? {} : { previousRefreshDigest: row.previous_refresh_digest }),
    ...(row.previous_refresh_valid_until === null ? {} : { previousRefreshValidUntil: row.previous_refresh_valid_until }),
    refreshExpiresAt: row.refresh_expires_at,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    ...(row.revoked_at === null ? {} : { revokedAt: row.revoked_at }),
  };
}

const CHALLENGE_COLUMNS = "id, account_id, purpose, email_lookup, email_lookup_version, installation_digest, code_digest, otp_key_version, expires_at, attempts_remaining, created_at, consumed_at, invalidated_at";
const SESSION_COLUMNS = "id, account_id, access_digest, access_expires_at, refresh_digest, previous_refresh_digest, previous_refresh_valid_until, refresh_expires_at, created_at, last_seen_at, revoked_at";

export class D1AuthRepository implements AuthRepository {
  constructor(private readonly database: D1Database) {}

  async consumeRateLimit(input: {
    scope: string; keyDigest: string; windowStartedAt: string; expiresAt: string; limit: number;
  }): Promise<boolean> {
    const row = await this.database.prepare(
      "INSERT INTO auth_rate_buckets (scope, key_digest, window_started_at, count, expires_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(scope, key_digest, window_started_at) DO UPDATE SET count = count + 1 WHERE count < ? RETURNING count",
    ).bind(input.scope, input.keyDigest, input.windowStartedAt, input.expiresAt, input.limit)
      .first<{ count: number }>();
    return row !== null;
  }

  async cleanupExpired(now: string, limit: number): Promise<boolean> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
      throw new Error("auth-cleanup-limit-invalid");
    }
    const results = await this.database.batch([
      this.database.prepare(
        "DELETE FROM auth_email_challenges WHERE rowid IN (SELECT rowid FROM auth_email_challenges WHERE expires_at < ? LIMIT ?)",
      ).bind(now, limit),
      this.database.prepare(
        "DELETE FROM auth_sessions WHERE rowid IN (SELECT rowid FROM auth_sessions WHERE refresh_expires_at < ? LIMIT ?)",
      ).bind(now, limit),
      this.database.prepare(
        "DELETE FROM auth_rate_buckets WHERE rowid IN (SELECT rowid FROM auth_rate_buckets WHERE expires_at < ? LIMIT ?)",
      ).bind(now, limit),
      this.database.prepare(
        "DELETE FROM auth_deletion_grants WHERE rowid IN (SELECT rowid FROM auth_deletion_grants WHERE expires_at < ? LIMIT ?)",
      ).bind(now, limit),
      this.database.prepare(
        "DELETE FROM auth_deletion_receipts WHERE rowid IN (SELECT rowid FROM auth_deletion_receipts WHERE expires_at < ? LIMIT ?)",
      ).bind(now, limit),
    ]);
    return results.some((result) => result.meta.changes >= limit);
  }

  async createChallenge(
    challenge: AuthChallenge,
    invalidateEmailLookups: readonly AuthEmailLookup[] = [challenge],
  ): Promise<void> {
    const lookupPredicate = invalidateEmailLookups
      .map(() => "(email_lookup_version = ? AND email_lookup = ?)")
      .join(" OR ");
    const lookupParams = invalidateEmailLookups.flatMap(
      (lookup) => [lookup.emailKeyVersion, lookup.emailLookup],
    );
    await this.database.batch([
      this.database.prepare(
        `UPDATE auth_email_challenges SET invalidated_at = ? WHERE purpose = ? AND (${lookupPredicate}) AND consumed_at IS NULL AND invalidated_at IS NULL`,
      ).bind(challenge.createdAt, challenge.purpose, ...lookupParams),
      this.database.prepare(
        "INSERT INTO auth_email_challenges (id, account_id, purpose, email_lookup, email_lookup_version, installation_digest, code_digest, otp_key_version, expires_at, attempts_remaining, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        challenge.id, challenge.accountId ?? null, challenge.purpose, challenge.emailLookup, challenge.emailKeyVersion,
        challenge.installationDigest, challenge.codeDigest, challenge.otpKeyVersion,
        challenge.expiresAt, challenge.attemptsRemaining, challenge.createdAt,
      ),
    ]);
  }

  async getChallenge(id: string): Promise<AuthChallenge | null> {
    const row = await this.database.prepare(
      `SELECT ${CHALLENGE_COLUMNS} FROM auth_email_challenges WHERE id = ? LIMIT 1`,
    ).bind(id).first<ChallengeRow>();
    return row === null ? null : challengeFrom(row);
  }

  async listChallenges(): Promise<AuthChallenge[]> {
    const result = await this.database.prepare(
      `SELECT ${CHALLENGE_COLUMNS} FROM auth_email_challenges ORDER BY created_at`,
    ).bind().all<ChallengeRow>();
    return result.results.map(challengeFrom);
  }

  async invalidateChallenge(id: string, at: string): Promise<void> {
    await this.database.prepare(
      "UPDATE auth_email_challenges SET invalidated_at = COALESCE(invalidated_at, ?) WHERE id = ?",
    ).bind(at, id).run();
  }

  async recordFailedAttempt(id: string, at: string): Promise<number> {
    const row = await this.database.prepare(
      "UPDATE auth_email_challenges SET attempts_remaining = MAX(0, attempts_remaining - 1), invalidated_at = CASE WHEN attempts_remaining <= 1 THEN ? ELSE invalidated_at END WHERE id = ? AND consumed_at IS NULL AND invalidated_at IS NULL RETURNING attempts_remaining",
    ).bind(at, id).first<{ attempts_remaining: number }>();
    return row?.attempts_remaining ?? 0;
  }

  async consumeChallenge(id: string, at: string): Promise<boolean> {
    const result = await this.database.prepare(
      "UPDATE auth_email_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL AND invalidated_at IS NULL",
    ).bind(at, id).run();
    return result.meta.changes === 1;
  }

  async findOrCreateAccount(input: AuthAccount): Promise<AuthAccount> {
    await this.database.prepare(
      "INSERT INTO auth_accounts (id, email_lookup, email_lookup_version, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(email_lookup_version, email_lookup) DO NOTHING",
    ).bind(input.id, input.emailLookup, input.emailKeyVersion, input.createdAt).run();
    const row = await this.database.prepare(
      "SELECT id, email_lookup, email_lookup_version, created_at FROM auth_accounts WHERE email_lookup_version = ? AND email_lookup = ? LIMIT 1",
    ).bind(input.emailKeyVersion, input.emailLookup).first<AccountRow>();
    if (row === null) throw new Error("auth-account-write-failed");
    return accountFrom(row);
  }

  async findAccountByEmailLookups(candidates: readonly AuthEmailLookup[]): Promise<AuthAccount | null> {
    if (candidates.length === 0) return null;
    const predicate = candidates.map(() => "(email_lookup_version = ? AND email_lookup = ?)").join(" OR ");
    const params = candidates.flatMap((candidate) => [candidate.emailKeyVersion, candidate.emailLookup]);
    const row = await this.database.prepare(
      `SELECT id, email_lookup, email_lookup_version, created_at FROM auth_accounts WHERE ${predicate} LIMIT 1`,
    ).bind(...params).first<AccountRow>();
    return row === null ? null : accountFrom(row);
  }

  async migrateAccountEmailLookup(
    accountId: string,
    lookup: AuthEmailLookup,
  ): Promise<AuthAccount | null> {
    const row = await this.database.prepare(
      "UPDATE auth_accounts SET email_lookup = ?, email_lookup_version = ? WHERE id = ? RETURNING id, email_lookup, email_lookup_version, created_at",
    ).bind(lookup.emailLookup, lookup.emailKeyVersion, accountId).first<AccountRow>();
    return row === null ? null : accountFrom(row);
  }

  async findAccountById(id: string): Promise<AuthAccount | null> {
    const row = await this.database.prepare(
      "SELECT id, email_lookup, email_lookup_version, created_at FROM auth_accounts WHERE id = ? LIMIT 1",
    ).bind(id).first<AccountRow>();
    return row === null ? null : accountFrom(row);
  }

  async createSession(session: AuthSession): Promise<void> {
    await this.database.prepare(
      "INSERT INTO auth_sessions (id, account_id, access_digest, access_expires_at, refresh_digest, refresh_expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      session.id, session.accountId, session.accessDigest, session.accessExpiresAt,
      session.refreshDigest, session.refreshExpiresAt, session.createdAt, session.lastSeenAt,
    ).run();
  }

  async findSessionByAccessDigest(digest: string): Promise<AuthSession | null> {
    const row = await this.database.prepare(
      `SELECT ${SESSION_COLUMNS} FROM auth_sessions WHERE access_digest = ? LIMIT 1`,
    ).bind(digest).first<SessionRow>();
    return row === null ? null : sessionFrom(row);
  }

  async findSessionByRefreshDigest(digest: string): Promise<AuthSession | null> {
    const row = await this.database.prepare(
      `SELECT ${SESSION_COLUMNS} FROM auth_sessions WHERE refresh_digest = ? OR previous_refresh_digest = ? LIMIT 1`,
    ).bind(digest, digest).first<SessionRow>();
    return row === null ? null : sessionFrom(row);
  }

  async rotateSession(input: {
    sessionId: string; presentedDigest: string; accessDigest: string; accessExpiresAt: string;
    refreshDigest: string; refreshExpiresAt: string; previousRefreshValidUntil: string; now: string;
  }): Promise<AuthSession | null> {
    const row = await this.database.prepare(
      `UPDATE auth_sessions SET previous_refresh_digest = refresh_digest, previous_refresh_valid_until = ?, refresh_digest = ?, refresh_expires_at = ?, access_digest = ?, access_expires_at = ?, last_seen_at = ? WHERE id = ? AND revoked_at IS NULL AND refresh_digest = ? RETURNING ${SESSION_COLUMNS}`,
    ).bind(
      input.previousRefreshValidUntil, input.refreshDigest, input.refreshExpiresAt,
      input.accessDigest, input.accessExpiresAt, input.now, input.sessionId,
      input.presentedDigest,
    ).first<SessionRow>();
    return row === null ? null : sessionFrom(row);
  }

  async revokeSessionByRefreshDigest(digest: string, at: string): Promise<void> {
    await this.database.prepare(
      "UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, ?) WHERE refresh_digest = ? OR previous_refresh_digest = ?",
    ).bind(at, digest, digest).run();
  }


  async createDeletionGrant(grant: AuthDeletionGrant): Promise<void> {
    await this.database.prepare(
      "INSERT INTO auth_deletion_grants (id, account_id, grant_digest, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
    ).bind(grant.id, grant.accountId, grant.grantDigest, grant.expiresAt, grant.createdAt).run();
  }

  async deleteAccountWithGrant(input: {
    grantDigest: string;
    idempotencyDigest: string;
    now: string;
    receiptExpiresAt: string;
  }): Promise<DeleteAccountResult> {
    const replay = await this.database.prepare(
      "SELECT idempotency_digest FROM auth_deletion_receipts WHERE idempotency_digest = ? AND grant_digest = ? AND expires_at >= ? LIMIT 1",
    ).bind(input.idempotencyDigest, input.grantDigest, input.now).first<{ idempotency_digest: string }>();
    if (replay !== null) return "replayed";
    const results = await this.database.batch([
      this.database.prepare(
        "INSERT INTO auth_deletion_receipts (idempotency_digest, grant_digest, created_at, expires_at) SELECT ?, ?, ?, ? FROM auth_deletion_grants WHERE grant_digest = ? AND consumed_at IS NULL AND expires_at >= ? ON CONFLICT(idempotency_digest) DO NOTHING",
      ).bind(
        input.idempotencyDigest, input.grantDigest, input.now, input.receiptExpiresAt,
        input.grantDigest, input.now,
      ),
      this.database.prepare(
        "UPDATE auth_deletion_grants SET consumed_at = ? WHERE grant_digest = ? AND consumed_at IS NULL AND expires_at >= ? AND EXISTS (SELECT 1 FROM auth_deletion_receipts WHERE idempotency_digest = ? AND grant_digest = ?)",
      ).bind(
        input.now, input.grantDigest, input.now, input.idempotencyDigest, input.grantDigest,
      ),
      this.database.prepare(
        "DELETE FROM auth_accounts WHERE id = (SELECT account_id FROM auth_deletion_grants WHERE grant_digest = ? AND consumed_at = ?) AND EXISTS (SELECT 1 FROM auth_deletion_receipts WHERE idempotency_digest = ? AND grant_digest = ?)",
      ).bind(input.grantDigest, input.now, input.idempotencyDigest, input.grantDigest),
    ]);
    if (results[0]?.meta.changes === 1) return "deleted";
    const racedReplay = await this.database.prepare(
      "SELECT idempotency_digest FROM auth_deletion_receipts WHERE idempotency_digest = ? AND grant_digest = ? AND expires_at >= ? LIMIT 1",
    ).bind(input.idempotencyDigest, input.grantDigest, input.now).first<{ idempotency_digest: string }>();
    return racedReplay === null ? "invalid" : "replayed";
  }
}

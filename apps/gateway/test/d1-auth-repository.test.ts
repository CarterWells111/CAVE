import { describe, expect, it, vi } from "vitest";

import { D1AuthRepository } from "../src/auth/d1-auth-repository";
import type { AuthChallenge } from "../src/auth/repository";

function databaseHarness(firstResult: unknown = null) {
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  const database = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          const record = { sql, params };
          statements.push(record);
          return {
            first: vi.fn(async () => firstResult),
            run: vi.fn(async () => ({ success: true, meta: { changes: 1 }, results: [] })),
            all: vi.fn(async () => ({ success: true, results: [], meta: {} })),
          };
        },
      };
    },
    batch: vi.fn(async (items: unknown[]) => items.map(() => ({ success: true, meta: { changes: 1 }, results: [] }))),
  };
  return { database: database as unknown as D1Database, statements, batch: database.batch };
}

const challenge: AuthChallenge = {
  id: "challenge-1",
  purpose: "sign_in",
  emailLookup: "email-hmac",
  emailKeyVersion: 1,
  installationDigest: "install-digest",
  codeDigest: "code-hmac",
  otpKeyVersion: 1,
  expiresAt: "2026-08-28T17:10:00.000Z",
  attemptsRemaining: 5,
  createdAt: "2026-08-28T17:00:00.000Z",
};

describe("D1 authentication repository", () => {
  it("invalidates the previous challenge and inserts the next one in one batch", async () => {
    const harness = databaseHarness();
    await new D1AuthRepository(harness.database).createChallenge(challenge);
    expect(harness.batch).toHaveBeenCalledTimes(1);
    expect(harness.statements.map(({ sql }) => sql)).toEqual([
      expect.stringContaining("UPDATE auth_email_challenges"),
      expect.stringContaining("INSERT INTO auth_email_challenges"),
    ]);
    expect(JSON.stringify(harness.statements)).not.toContain("person@example.com");
  });

  it("maps a challenge row without inventing plaintext identity fields", async () => {
    const harness = databaseHarness({
      id: challenge.id,
      purpose: challenge.purpose,
      email_lookup: challenge.emailLookup,
      email_lookup_version: challenge.emailKeyVersion,
      installation_digest: challenge.installationDigest,
      code_digest: challenge.codeDigest,
      otp_key_version: challenge.otpKeyVersion,
      expires_at: challenge.expiresAt,
      attempts_remaining: challenge.attemptsRemaining,
      created_at: challenge.createdAt,
      consumed_at: null,
      invalidated_at: null,
    });
    await expect(new D1AuthRepository(harness.database).getChallenge(challenge.id)).resolves.toEqual(challenge);
    expect(harness.statements[0]?.sql).not.toMatch(/SELECT \*/u);
  });

  it("uses conditional updates for consumption and refresh rotation", async () => {
    const harness = databaseHarness();
    const repository = new D1AuthRepository(harness.database);
    await repository.consumeChallenge("challenge-1", "now");
    await repository.rotateSession({
      sessionId: "session-1", presentedDigest: "old", accessDigest: "access",
      accessExpiresAt: "access-exp", refreshDigest: "new", refreshExpiresAt: "refresh-exp",
      previousRefreshValidUntil: "grace", now: "now",
    });
    expect(harness.statements.some(({ sql }) => sql.includes("consumed_at IS NULL"))).toBe(true);
    expect(harness.statements.some(({ sql }) => sql.includes("refresh_digest = ?") && sql.includes("previous_refresh_digest"))).toBe(true);
  });

  it("consumes a deletion grant, records idempotency, and deletes the account in one batch", async () => {
    const harness = databaseHarness();
    const result = await new D1AuthRepository(harness.database).deleteAccountWithGrant({
      grantDigest: "grant-digest",
      idempotencyDigest: "idempotency-digest",
      now: "2026-08-28T17:00:00.000Z",
      receiptExpiresAt: "2026-08-29T17:00:00.000Z",
    });
    expect(result).toBe("deleted");
    expect(harness.batch).toHaveBeenCalledTimes(1);
    expect(harness.statements.slice(1).map(({ sql }) => sql)).toEqual([
      expect.stringContaining("auth_deletion_receipts"),
      expect.stringContaining("UPDATE auth_deletion_grants"),
      expect.stringContaining("DELETE FROM auth_accounts"),
    ]);
  });

  it("cleans expired operational metadata in bounded batches without touching accounts", async () => {
    const harness = databaseHarness();
    await expect(new D1AuthRepository(harness.database).cleanupExpired(
      "2026-08-29T17:00:00.000Z",
      500,
    )).resolves.toBe(false);
    expect(harness.batch).toHaveBeenCalledTimes(1);
    expect(harness.statements).toHaveLength(5);
    expect(harness.statements.every(({ sql, params }) => (
      sql.startsWith("DELETE FROM auth_") && sql.includes("LIMIT ?") && params.at(-1) === 500
    ))).toBe(true);
    expect(harness.statements.map(({ sql }) => sql).join(" ")).not.toContain("DELETE FROM auth_accounts");
  });
});

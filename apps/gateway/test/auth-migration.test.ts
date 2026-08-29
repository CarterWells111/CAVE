import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(fileURLToPath(new URL("../migrations/0001_auth.sql", import.meta.url)), "utf8");

describe("authentication D1 migration", () => {
  it("creates only account, challenge, session, abuse and deletion metadata tables", () => {
    for (const table of [
      "auth_accounts",
      "auth_email_challenges",
      "auth_sessions",
      "auth_rate_buckets",
      "auth_email_suppressions",
      "auth_deletion_grants",
      "auth_deletion_receipts",
    ]) expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
  });

  it("does not create cloud-content or plaintext-email columns", () => {
    expect(sql).not.toMatch(/journal|journey|review|communication_card|transcript|intimate/iu);
    expect(sql).not.toMatch(/\bemail\s+TEXT/iu);
    expect(sql).toContain("email_lookup TEXT NOT NULL");
    expect(sql).toContain("refresh_digest TEXT NOT NULL UNIQUE");
    expect(sql).toMatch(/auth_deletion_receipts[\s\S]*grant_digest TEXT NOT NULL/iu);
  });

  it("uses foreign keys and bounded state constraints", () => {
    expect(sql).toContain("REFERENCES auth_accounts(id) ON DELETE CASCADE");
    expect(sql).toContain("CHECK (purpose IN ('sign_in', 'account_delete'))");
    expect(sql).toContain("CHECK (attempts_remaining BETWEEN 0 AND 5)");
  });
});

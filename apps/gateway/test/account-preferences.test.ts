import { existsSync, readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { digestOpaqueToken } from "../src/auth/crypto";
import { D1AuthRepository } from "../src/auth/d1-auth-repository";
import { InMemoryRateLimitStore } from "../src/security/rate-limit";

const requestId = "7cbbc0f9-9d12-4b08-9741-75bbb399e7c6";
const migration = fileURLToPath(new URL("../migrations/0002_account_preferences.sql", import.meta.url));
const databases: DatabaseSync[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });

async function harness() {
  const db = new DatabaseSync(":memory:");
  databases.push(db);
  db.exec(readFileSync(fileURLToPath(new URL("../migrations/0001_auth.sql", import.meta.url)), "utf8"));
  if (existsSync(migration)) db.exec(readFileSync(migration, "utf8"));
  // Execute the actual repository SQL against SQLite; only the D1 transport is adapted.
  const binding = {
    prepare(sql: string) {
      return { bind(...params: SQLInputValue[]) {
        return { async first() { return db.prepare(sql).get(...params) ?? null; } };
      } };
    },
  } as unknown as D1Database;
  for (const suffix of ["a", "b"]) {
    db.prepare("INSERT INTO auth_accounts VALUES (?, ?, 1, ?)").run(suffix, `lookup-${suffix}`, "2026-09-04T00:00:00.000Z");
    db.prepare(`INSERT INTO auth_sessions (id, account_id, access_digest, access_expires_at, refresh_digest, refresh_expires_at, created_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(`session-${suffix}`, suffix, await digestOpaqueToken(`cave_at_${suffix.repeat(43)}`), "2099-01-01T00:00:00.000Z", `refresh-${suffix}`, "2099-01-01T00:00:00.000Z", "2026-09-04T00:00:00.000Z", "2026-09-04T00:00:00.000Z");
  }
  const logs: string[] = [];
  const app = createApp({ MODEL_MODE: "mock", PROMPT_VERSION: "prompt-v1", POLICY_VERSION: "policy-v1", AUTH_DB: binding }, {
    rateLimitStore: new InMemoryRateLimitStore(), logger: (line) => logs.push(line),
  });
  function get(token = `cave_at_${"a".repeat(43)}`, query = `requestId=${requestId}`) {
    return app.request(`/v1/account/preferences?${query}`, { headers: { authorization: `Bearer ${token}` } });
  }
  function patch(changes: unknown, revision = 0, token = `cave_at_${"a".repeat(43)}`, extra = {}) {
    return app.request("/v1/account/preferences", { method: "PATCH", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ contractVersion: "1", requestId, expectedRevision: revision, changes, ...extra }) });
  }
  return { db, binding, get, patch, app, logs };
}

describe("account preferences through production gateway composition", () => {
  it("returns privacy-preserving defaults with no-store", async () => {
    const h = await harness();
    const response = await h.get();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ contractVersion: "1", requestId, preferences: { ageConfirmed: false, addressPreference: null, updatedAt: null, revision: 0 } });
  });

  it("preserves omitted fields and accepts false/null updates", async () => {
    const h = await harness();
    expect((await h.patch({ ageConfirmed: true })).status).toBe(200);
    const second = await h.patch({ addressPreference: "妳" }, 1);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ preferences: { ageConfirmed: true, addressPreference: "妳", revision: 2, updatedAt: expect.any(String) } });
    await h.patch({ ageConfirmed: false, addressPreference: null }, 2);
    expect(await (await h.get()).json()).toMatchObject({ preferences: { ageConfirmed: false, addressPreference: null, revision: 3 } });
  });

  it("isolates accounts and rejects client supplied identities", async () => {
    const h = await harness();
    await h.patch({ ageConfirmed: true });
    expect(await (await h.get(`cave_at_${"b".repeat(43)}`)).json()).toMatchObject({ preferences: { ageConfirmed: false, revision: 0 } });
    expect((await h.patch({ ageConfirmed: false }, 1, undefined, { accountId: "b" })).status).toBe(400);
    expect((await h.get(undefined, `requestId=${requestId}&accountId=b`)).status).toBe(400);
  });

  it("rejects missing, unknown, revoked and expired access tokens", async () => {
    const h = await harness();
    expect((await h.app.request(`/v1/account/preferences?requestId=${requestId}`)).status).toBe(401);
    expect((await h.get(`cave_at_${"c".repeat(43)}`)).status).toBe(401);
    h.db.exec("UPDATE auth_sessions SET revoked_at = '2026-09-04T00:00:00.000Z' WHERE account_id = 'a'");
    expect((await h.get()).status).toBe(401);
    expect((await h.patch({ ageConfirmed: true })).status).toBe(401);
    h.db.exec("UPDATE auth_sessions SET access_expires_at = '2000-01-01T00:00:00.000Z' WHERE account_id = 'b'");
    expect((await h.get(`cave_at_${"b".repeat(43)}`)).status).toBe(401);
  });

  it("rejects malformed and oversized requests with bounded responses", async () => {
    const h = await harness();
    for (const changes of [{}, { unknown: true }, { ageConfirmed: "true" }, { addressPreference: "other" }]) expect((await h.patch(changes)).status).toBe(400);
    expect((await h.get(undefined, "requestId=secret-canary")).status).toBe(400);
    const malformed = await h.app.request("/v1/account/preferences", { method: "PATCH", headers: { "content-type": "application/json" }, body: "{" });
    expect(malformed.status).toBe(400);
    const oversized = await h.patch({ ageConfirmed: "x".repeat(17 * 1024) });
    expect(oversized.status).toBe(413);
    expect(JSON.stringify(h.logs)).not.toContain("secret-canary");
    expect(JSON.stringify(h.logs)).not.toContain("cave_at_");
  });

  it("rejects stale and competing revisions without overwriting newer preferences", async () => {
    const h = await harness();
    expect((await h.patch({ ageConfirmed: true }, 9)).status).toBe(409);
    const responses = await Promise.all([h.patch({ ageConfirmed: true }), h.patch({ addressPreference: "你" })]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const stale = await h.patch({ ageConfirmed: false });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: "ACCOUNT_PREFERENCES_CONFLICT", requestId });
    expect(await (await h.get()).json()).toMatchObject({ preferences: { revision: 1 } });
  });

  it("migrates existing accounts and cascades preference deletion", async () => {
    expect(existsSync(migration)).toBe(true);
    const h = await harness();
    await h.patch({ ageConfirmed: true });
    h.db.exec("DELETE FROM auth_accounts WHERE id = 'a'");
    expect(h.db.prepare("SELECT count(*) AS total FROM account_preferences").get()).toMatchObject({ total: 0 });
    expect((await h.get()).status).toBe(401);
    expect(await new D1AuthRepository(h.binding).findAccountById("b")).not.toBeNull();
  });
});

import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, expect, it } from "vitest";
import { D1AssistantUsageStore, parseAssistantLimit } from "../src/services/assistant-usage";
const databases: DatabaseSync[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });
function harness(hour: number | null = 2, day: number | null = 3) {
  const db = new DatabaseSync(":memory:"); databases.push(db);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(readFileSync(new URL("../migrations/0001_auth.sql", import.meta.url), "utf8"));
  db.exec(readFileSync(new URL("../migrations/0003_assistant_usage.sql", import.meta.url), "utf8"));
  for (const id of ["a", "b"]) db.prepare("INSERT INTO auth_accounts VALUES (?, ?, 1, '2026-09-09')").run(id, id);
  const binding = { prepare(sql: string) { return { bind(...args: SQLInputValue[]) { return {
    first: async () => db.prepare(sql).get(...args) ?? null,
    run: async () => ({ success: true, meta: { changes: Number(db.prepare(sql).run(...args).changes) } }),
  }; } }; } } as unknown as D1Database;
  return { db, first: new D1AssistantUsageStore(binding, { hour, day }), second: new D1AssistantUsageStore(binding, { hour, day }) };
}
const now = Date.parse("2026-09-09T10:30:00Z");
it("atomically shares hourly and daily caps across concurrent devices without partial charges", async () => {
  const { first, second } = harness();
  const results = await Promise.all([first.consume("a", now), second.consume("a", now), first.consume("a", now)]);
  expect(results.filter(Boolean)).toHaveLength(2);
  expect(await first.read("a", now)).toMatchObject({ hour: { used: 2 }, day: { used: 2 } });
  expect(await first.consume("a", now + 3600000)).toBe(true);
  expect(await second.consume("a", now + 3600000)).toBe(false);
  expect(await first.read("a", now + 3600000)).toMatchObject({ hour: { used: 1 }, day: { used: 3 } });
  expect(await second.consume("b", now)).toBe(true);
});
it("resets on exact UTC boundaries and deletes counters with account", async () => {
  const { db, first } = harness();
  await first.consume("a", now);
  expect(await first.read("a", Date.parse("2026-09-09T11:00:00Z"))).toMatchObject({ hour: { used: 0, resetsAt: "2026-09-09T12:00:00.000Z" }, day: { used: 1 } });
  expect(await first.read("a", Date.parse("2026-09-10T00:00:00Z"))).toMatchObject({ hour: { used: 0 }, day: { used: 0 } });
  db.prepare("DELETE FROM auth_accounts WHERE id = 'a'").run();
  expect(db.prepare("SELECT COUNT(*) AS n FROM assistant_usage").get()?.n).toBe(0);
});
it("keeps counts but no invented caps when limits are not decided", async () => {
  const { first } = harness(null, null);
  for (let i = 0; i < 5; i++) expect(await first.consume("a", now)).toBe(true);
  expect(await first.read("a", now)).toMatchObject({ hour: { used: 5, limit: null }, day: { used: 5, limit: null } });
});
it("rejects invalid operator settings", () => {
  expect(parseAssistantLimit(undefined)).toBeNull();
  expect(parseAssistantLimit("12")).toBe(12);
  for (const value of ["0", "-1", "1.5", "hello", "9007199254740992"]) expect(() => parseAssistantLimit(value)).toThrow();
});

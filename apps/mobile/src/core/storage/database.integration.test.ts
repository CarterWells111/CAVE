/** @jest-environment node */
import { existsSync, writeFileSync } from "node:fs";
import { createSqliteFileHarness } from "../../test/storage/sqlite-file-harness";
import { HISTORICAL_DATABASE_FIXTURES } from "../../test/storage/historical-fixtures";
import { SECRET_NAMES } from "./key-store";

const fixtures = HISTORICAL_DATABASE_FIXTURES;
type Harness = ReturnType<typeof createSqliteFileHarness>;
const active: Harness[] = [];
function harness(id: string) {
  const result = createSqliteFileHarness(fixtures.find((fixture) => fixture.id === id)!);
  active.push(result);
  return result;
}
afterEach(() => { for (const h of active.splice(0)) h.cleanup(); });

function snapshot(h: Harness) {
  const db = h.openRaw();
  try {
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
    return Object.fromEntries(names.map(({ name }) => [name, db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()]));
  } finally { h.closeRaw(db); }
}

describe("real SQLite file migration durability (not encryption)", () => {
  test.each(fixtures)("preserves historical rows and relationships from $id", async (fixture) => {
    const h = harness(fixture.id);
    const before = snapshot(h);
    const manager = h.manager();
    const connection = await manager.initialize();
    expect(await connection.getFirstAsync("PRAGMA user_version")).toEqual({ user_version: 12 });
    expect(await connection.getAllAsync("PRAGMA foreign_key_check")).toEqual([]);
    await manager.close();
    const after = snapshot(h);
    for (const [table, rows] of Object.entries(before)) {
      expect(after[table]).toHaveLength(rows.length);
      rows.forEach((row, index) => expect(after[table]?.[index]).toMatchObject(row));
    }
    if (fixture.id.includes("legacy")) {
      expect(after.local_journal_preferences).toEqual([{ singleton_id: 1, show_save_notice: fixture.id.endsWith("-on") ? 1 : 0 }]);
    }
    if (fixture.version >= 11) {
      expect(after.journal_records?.[0]).toMatchObject({ owner_account_id: fixture.version === 12 ? "account-fixture" : null });
      expect(after.journal_period_reviews?.[0]).toMatchObject({ owner_account_id: fixture.version === 12 ? "account-fixture" : null });
      expect(after.journal_entries?.[0]).toMatchObject({ record_id: "journal-fixture" });
    }
    await h.manager().initialize();
    await h.manager().close();
    expect(snapshot(h)).toEqual(after);
  });

  test.each(["schema", "data", "version", "commit"])("rolls back only the current migration after %s failure, then reopens and retries", async (stage) => {
    const h = harness("v6-legacy-collision");
    const failure = new Error(`injected-${stage}`);
    let v9 = false;
    let triggered = false;
    h.setFault((operation, sql) => {
      if (sql.includes("PRAGMA table_info(privacy_settings)")) v9 = true;
      const matches = stage === "schema" ? operation === "exec-after" && sql.includes("CREATE TABLE IF NOT EXISTS local_journal_preferences")
        : stage === "data" ? operation === "run-after" && sql.includes("INSERT INTO local_journal_preferences")
          : stage === "version" ? operation === "exec-after" && sql === "PRAGMA user_version = 9"
            : operation === "exec" && v9 && sql === "COMMIT";
      if (!triggered && matches) { triggered = true; throw failure; }
    });
    await expect(h.manager().initialize()).rejects.toBe(failure);
    expect(triggered).toBe(true);
    const db = h.openRaw();
    expect(db.prepare("PRAGMA user_version").get()).toEqual({ user_version: stage === "schema" ? 7 : 8 });
    expect(db.prepare("SELECT payload FROM journey_drafts_v3").get()).toEqual({ payload: '{"fixture":3}' });
    if (stage !== "schema") expect(db.prepare("SELECT * FROM local_journal_preferences").all()).toEqual([]);
    else expect(db.prepare("SELECT name FROM sqlite_master WHERE name IN ('local_journal_preferences','app_preferences')").all()).toEqual([]);
    h.closeRaw(db);
    h.setFault();
    const reopened = await h.manager().initialize();
    expect(await reopened.getFirstAsync("PRAGMA user_version")).toEqual({ user_version: 12 });
    expect(await reopened.getFirstAsync("SELECT show_save_notice FROM local_journal_preferences")).toEqual({ show_save_notice: 0 });
    await h.manager().close();
  });

  test("rolls back both ownership changes when the second v12 ALTER fails, preserving the v11 journal", async () => {
    const h = harness("v11");
    const before = snapshot(h);
    h.setFault((operation, sql) => {
      if (operation === "run-after" && sql === "ALTER TABLE journal_period_reviews ADD COLUMN owner_account_id TEXT") throw new Error("ownership interrupted");
    });
    await expect(h.manager().initialize()).rejects.toThrow("ownership interrupted");
    expect(snapshot(h)).toEqual(before);
    const db = h.openRaw();
    expect(db.prepare("PRAGMA user_version").get()).toEqual({ user_version: 11 });
    h.closeRaw(db);
    h.setFault();
    await h.manager().initialize();
    await h.manager().close();
    expect(snapshot(h).journal_records?.[0]).toMatchObject({ owner_account_id: null, body: "synthetic body" });
  });

  test("retains the migration error through rollback and close failures, then closes the poisoned file before retry", async () => {
    const h = harness("v6-legacy-collision");
    const migrationError = new Error("migration interrupted");
    const rollbackError = new Error("rollback interrupted");
    const closeError = new Error("close interrupted");
    h.setFault((operation, sql) => {
      if (operation === "run-after" && sql.includes("INSERT INTO local_journal_preferences")) throw migrationError;
      if (operation === "exec" && sql === "ROLLBACK") throw rollbackError;
      if (operation === "close") throw closeError;
    });
    await expect(h.manager().initialize()).rejects.toBe(migrationError);
    expect(migrationError).toMatchObject({ rollbackError, cause: closeError });
    h.setFault();
    await h.manager().close();
    const db = h.openRaw();
    expect(db.prepare("PRAGMA user_version").get()).toEqual({ user_version: 8 });
    expect(db.prepare("SELECT * FROM local_journal_preferences").all()).toEqual([]);
    h.closeRaw(db);
    await h.manager().initialize();
    await h.manager().close();
    expect(snapshot(h).local_journal_preferences).toEqual([{ singleton_id: 1, show_save_notice: 0 }]);
  });

  test.each(["missing-key", "missing-database", "future", "malformed", "busy"])("preserves storage after %s failure", async (scenario) => {
    const h = harness("v12");
    if (scenario === "missing-key") h.values.delete(SECRET_NAMES.databaseKey);
    if (scenario === "missing-database") await h.files.removeDatabaseFiles();
    if (scenario === "malformed") writeFileSync(h.path, "synthetic malformed SQLite fixture");
    let lock: ReturnType<Harness["openRaw"]> | undefined;
    if (scenario === "future") {
      const db = h.openRaw(); db.exec("PRAGMA user_version=999"); h.closeRaw(db);
    }
    if (scenario === "busy") { lock = h.openRaw(); lock.exec("BEGIN IMMEDIATE"); }
    const key = h.values.get(SECRET_NAMES.databaseKey);
    const bytes = existsSync(h.path) ? h.bytes() : null;
    h.events.length = 0;
    await expect(h.manager().initialize()).rejects.toThrow();
    if (lock) { lock.exec("ROLLBACK"); h.closeRaw(lock); }
    expect(h.events).not.toContain("removed-files");
    expect(h.values.get(SECRET_NAMES.databaseKey)).toBe(key);
    if (bytes) expect(h.bytes()).toEqual(bytes);
    else expect(existsSync(h.path)).toBe(false);
    expect(h.events.filter((event) => event.includes("CREATE TABLE"))).toEqual([]);
  });
});

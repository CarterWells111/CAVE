import { createEncryptedDatabaseManager } from "./database";

const VALID_DATABASE_KEY = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";

function makeHarness(options: {
  databaseExists?: boolean;
  key?: string | null;
  failVersionOnce?: boolean;
  failSqlOnce?: string;
  userVersion?: number;
} = {}) {
  let exists = options.databaseExists ?? false;
  let key = options.key ?? null;
  let failVersionOnce = options.failVersionOnce ?? false;
  let failSqlOnce = options.failSqlOnce;
  let userVersion = options.userVersion ?? 0;
  const calls: string[] = [];
  const database = {
    execAsync: jest.fn(async (sql: string) => {
      calls.push(sql);
      if (sql === failSqlOnce) {
        failSqlOnce = undefined;
        throw new Error("migration write failed");
      }
      const version = /^PRAGMA user_version = (\d+)$/u.exec(sql);
      if (version?.[1] !== undefined) userVersion = Number(version[1]);
    }),
    runAsync: jest.fn(async () => ({ changes: 0 })),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async (sql: string) => {
      calls.push(sql);
      if (failVersionOnce) { failVersionOnce = false; throw new Error("file is encrypted"); }
      return { user_version: userVersion };
    }),
    closeAsync: jest.fn(async () => { calls.push("close"); })
  };
  const secrets = {
    getDatabaseKey: jest.fn(async () => key),
    getOrCreateDatabaseKey: jest.fn(async () => {
      if (key === null) key = VALID_DATABASE_KEY;
      return key;
    }),
    getOrCreateInstallationToken: jest.fn(async () => "token"),
    deleteDatabaseKey: jest.fn(async () => { key = null; }),
    deleteAllSecrets: jest.fn(async () => { key = null; })
  };
  const files = {
    databaseExists: jest.fn(async () => exists),
    removeDatabaseFiles: jest.fn(async () => { exists = false; calls.push("remove-files"); })
  };
  const native = { openDatabaseAsync: jest.fn(async () => { exists = true; calls.push("open"); return database; }) };
  return { calls, database, files, native, secrets };
}

describe("encrypted database lifecycle", () => {
  test("applies key before any schema access, then enables integrity pragmas", async () => {
    const harness = makeHarness();
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    await manager.initialize();

    expect(harness.calls.slice(0, 5)).toEqual([
      "open",
      `PRAGMA key = '${VALID_DATABASE_KEY}'`,
      "PRAGMA foreign_keys = ON",
      "PRAGMA journal_mode = WAL",
      "PRAGMA user_version"
    ]);
    expect(harness.calls.findIndex((call) => call.includes("CREATE TABLE"))).toBeGreaterThan(4);
    expect(harness.calls.join("\n")).not.toContain("transcript_history");
  });

  test("migrates a new encrypted database through v1-v6 without replacing tables", async () => {
    const harness = makeHarness();
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );

    await manager.initialize();

    const schemaSql = harness.calls.join("\n");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS course_progress");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS saved_records");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS privacy_settings");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS journey_drafts");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS journey_cards");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS journey_drafts_v2");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS journey_drafts_v3");
    expect(schemaSql).toContain("CHECK (schema_version = 3)");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS app_shell_state");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS journey_active_review");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS journey_review_versions");
    expect(harness.calls.filter((call) => call.startsWith("PRAGMA user_version ="))).toEqual([
      "PRAGMA user_version = 1",
      "PRAGMA user_version = 2",
      "PRAGMA user_version = 3",
      "PRAGMA user_version = 4",
      "PRAGMA user_version = 5",
      "PRAGMA user_version = 6"
    ]);
  });

  test("applies v2 through v4 when opening a v1 database", async () => {
    const harness = makeHarness({ databaseExists: true, key: VALID_DATABASE_KEY, userVersion: 1 });

    await createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    ).initialize();

    const schemaSql = harness.calls.join("\n");
    expect(schemaSql).not.toContain("CREATE TABLE IF NOT EXISTS course_progress");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS journey_drafts");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS journey_drafts_v2");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS journey_drafts_v3");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS app_shell_state");
    expect(harness.calls.filter((call) => call.startsWith("PRAGMA user_version ="))).toEqual([
      "PRAGMA user_version = 2",
      "PRAGMA user_version = 3",
      "PRAGMA user_version = 4",
      "PRAGMA user_version = 5",
      "PRAGMA user_version = 6"
    ]);
  });

  test("adds the seven-screen v2 draft tables without rewriting the legacy v1 table", async () => {
    const harness = makeHarness({ databaseExists: true, key: VALID_DATABASE_KEY, userVersion: 2 });

    await createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    ).initialize();

    const schemaSql = harness.calls.join("\n");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS journey_drafts_v2");
    expect(schemaSql).toContain("CHECK (schema_version = 2)");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS journey_migration_receipts");
    expect(schemaSql).not.toContain("DROP TABLE");
    expect(harness.calls).toContain("PRAGMA user_version = 3");
    expect(harness.calls).toContain("PRAGMA user_version = 4");
    expect(harness.calls).toContain("PRAGMA user_version = 5");
    expect(harness.calls).toContain("PRAGMA user_version = 6");
  });

  test("applies the v3 migration in its own transaction", async () => {
    const harness = makeHarness({ databaseExists: true, key: VALID_DATABASE_KEY, userVersion: 2 });

    await createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    ).initialize();

    const begin = harness.calls.indexOf("BEGIN IMMEDIATE");
    const schema = harness.calls.findIndex((call) => call.includes("journey_drafts_v2"));
    const version = harness.calls.indexOf("PRAGMA user_version = 3");
    const commit = harness.calls.indexOf("COMMIT");
    expect(begin).toBeGreaterThan(-1);
    expect(schema).toBeGreaterThan(begin);
    expect(version).toBeGreaterThan(schema);
    expect(commit).toBeGreaterThan(version);
  });

  test("adds the app shell singleton when opening a v3 database", async () => {
    const harness = makeHarness({ databaseExists: true, key: VALID_DATABASE_KEY, userVersion: 3 });

    await createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    ).initialize();

    const schemaSql = harness.calls.join("\n");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS app_shell_state");
    expect(schemaSql).toContain("CHECK (singleton_id = 1)");
    expect(schemaSql).not.toContain("CREATE TABLE IF NOT EXISTS journey_drafts_v2");
    expect(schemaSql).not.toContain("DROP TABLE");
    expect(harness.calls).toContain("PRAGMA user_version = 4");
    expect(harness.calls).toContain("PRAGMA user_version = 5");
    expect(harness.calls).toContain("PRAGMA user_version = 6");
    const begin = harness.calls.indexOf("BEGIN IMMEDIATE");
    const schema = harness.calls.findIndex((call) => call.includes("app_shell_state"));
    const version = harness.calls.indexOf("PRAGMA user_version = 4");
    const commit = harness.calls.indexOf("COMMIT");
    expect(begin).toBeGreaterThan(-1);
    expect(schema).toBeGreaterThan(begin);
    expect(version).toBeGreaterThan(schema);
    expect(commit).toBeGreaterThan(version);
  });

  test("adds versioned review tables when opening a v4 database", async () => {
    const harness = makeHarness({ databaseExists: true, key: VALID_DATABASE_KEY, userVersion: 4 });

    await createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    ).initialize();

    expect(harness.calls.join("\n")).toContain("CREATE TABLE IF NOT EXISTS journey_review_versions");
    expect(harness.calls.join("\n")).not.toContain("DROP TABLE");
    expect(harness.calls).toContain("PRAGMA user_version = 5");
    expect(harness.calls).toContain("PRAGMA user_version = 6");
  });

  test("adds the schema-v3 draft table when opening a v5 database", async () => {
    const harness = makeHarness({ databaseExists: true, key: VALID_DATABASE_KEY, userVersion: 5 });

    await createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    ).initialize();

    const schemaSql = harness.calls.join("\n");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS journey_drafts_v3");
    expect(schemaSql).toContain("CHECK (schema_version = 3)");
    expect(schemaSql).not.toContain("DROP TABLE");
    expect(harness.calls.filter((call) => call.startsWith("PRAGMA user_version =")))
      .toEqual(["PRAGMA user_version = 6"]);
  });

  test("rolls back a failed v6 migration, then retries once and remains idempotent", async () => {
    const harness = makeHarness({
      databaseExists: true,
      key: VALID_DATABASE_KEY,
      userVersion: 5,
      failSqlOnce: "PRAGMA user_version = 6"
    });
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );

    await expect(manager.initialize()).rejects.toThrow("migration write failed");
    expect(harness.calls).toContain("ROLLBACK");

    await manager.initialize();
    await manager.close();
    await manager.initialize();

    expect(harness.calls.filter((call) => call.includes("CREATE TABLE IF NOT EXISTS journey_drafts_v3")))
      .toHaveLength(2);
    expect(harness.calls.filter((call) => call === "PRAGMA user_version = 6")).toHaveLength(2);
    expect(harness.calls.at(-1)).toBe("PRAGMA user_version");
  });

  test("rejects a database created by a future app version without mutating it", async () => {
    const harness = makeHarness({ databaseExists: true, key: VALID_DATABASE_KEY, userVersion: 7 });
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );

    await expect(manager.initialize()).rejects.toThrow("Unsupported database version: 7");
    expect(harness.calls.join("\n")).not.toContain("CREATE TABLE");
    expect(harness.calls).not.toContain("PRAGMA user_version = 2");
    expect(harness.files.removeDatabaseFiles).not.toHaveBeenCalled();
  });

  test.each([
    ["old key without database", false, VALID_DATABASE_KEY],
    ["database without key", true, null]
  ])("safely clears and recreates %s", async (_name, databaseExists, key) => {
    const harness = makeHarness({ databaseExists, key });
    await createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    ).initialize();

    expect(harness.files.removeDatabaseFiles).toHaveBeenCalledTimes(1);
    expect(harness.secrets.deleteDatabaseKey).toHaveBeenCalledTimes(key === null ? 0 : 1);
    expect(harness.secrets.getOrCreateDatabaseKey).toHaveBeenCalledTimes(1);
  });

  test("clears both database and key after a key/database mismatch", async () => {
    const harness = makeHarness({
      databaseExists: true,
      key: VALID_DATABASE_KEY,
      failVersionOnce: true
    });
    await createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    ).initialize();

    expect(harness.database.closeAsync).toHaveBeenCalledTimes(1);
    expect(harness.files.removeDatabaseFiles).toHaveBeenCalledTimes(1);
    expect(harness.secrets.deleteDatabaseKey).toHaveBeenCalledTimes(1);
    expect(harness.native.openDatabaseAsync).toHaveBeenCalledTimes(2);
  });

  test("preserves database and key when initialization fails for a non-key error", async () => {
    const harness = makeHarness({ databaseExists: true, key: VALID_DATABASE_KEY });
    const diskError = new Error("disk I/O error");
    harness.database.getFirstAsync.mockRejectedValueOnce(diskError);
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );

    await expect(manager.initialize()).rejects.toBe(diskError);
    expect(harness.database.closeAsync).toHaveBeenCalledTimes(1);
    expect(harness.files.removeDatabaseFiles).not.toHaveBeenCalled();
    expect(harness.secrets.deleteDatabaseKey).not.toHaveBeenCalled();
    expect(harness.native.openDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  test("clears a corrupted existing SecureStore key and reopens with a fresh key", async () => {
    const harness = makeHarness({ databaseExists: true, key: "corrupted-key" });
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );

    await manager.initialize();

    expect(harness.files.removeDatabaseFiles).toHaveBeenCalledTimes(1);
    expect(harness.secrets.deleteDatabaseKey).toHaveBeenCalledTimes(1);
    expect(harness.native.openDatabaseAsync).toHaveBeenCalledTimes(1);
    expect(harness.calls).toContain(`PRAGMA key = '${VALID_DATABASE_KEY}'`);
  });

  test("coalesces concurrent initialization into one key, connection, and migration run", async () => {
    const harness = makeHarness();
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );

    const [first, second] = await Promise.all([manager.initialize(), manager.initialize()]);

    expect(first).toBe(second);
    expect(harness.secrets.getOrCreateDatabaseKey).toHaveBeenCalledTimes(1);
    expect(harness.native.openDatabaseAsync).toHaveBeenCalledTimes(1);
    expect(harness.calls.filter((call) => call === "PRAGMA user_version")).toHaveLength(1);
  });

  test("shares an initialization failure and allows the next caller to retry", async () => {
    const harness = makeHarness({ databaseExists: true, key: VALID_DATABASE_KEY });
    const diskError = new Error("disk I/O error");
    harness.database.getFirstAsync.mockRejectedValueOnce(diskError);
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );

    const failed = await Promise.allSettled([manager.initialize(), manager.initialize()]);

    expect(failed).toEqual([
      { status: "rejected", reason: diskError },
      { status: "rejected", reason: diskError }
    ]);
    expect(harness.native.openDatabaseAsync).toHaveBeenCalledTimes(1);

    await expect(manager.initialize()).resolves.toBe(harness.database);
    expect(harness.native.openDatabaseAsync).toHaveBeenCalledTimes(2);
  });
});

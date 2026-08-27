import { createEncryptedDatabaseManager } from "./database";

const VALID_DATABASE_KEY = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";

function makeHarness(options: {
  databaseExists?: boolean;
  key?: string | null;
  failVersionOnce?: boolean;
  userVersion?: number;
} = {}) {
  let exists = options.databaseExists ?? false;
  let key = options.key ?? null;
  let failVersionOnce = options.failVersionOnce ?? false;
  const calls: string[] = [];
  const database = {
    execAsync: jest.fn(async (sql: string) => { calls.push(sql); }),
    runAsync: jest.fn(async () => ({ changes: 0 })),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async (sql: string) => {
      calls.push(sql);
      if (failVersionOnce) { failVersionOnce = false; throw new Error("file is encrypted"); }
      return { user_version: options.userVersion ?? 0 };
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

  test("migrates the encrypted database to v2 without replacing v1 tables", async () => {
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
    expect(harness.calls).toContain("PRAGMA user_version = 2");
  });

  test("applies only the v2 migration when opening a v1 database", async () => {
    const harness = makeHarness({ databaseExists: true, key: VALID_DATABASE_KEY, userVersion: 1 });

    await createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    ).initialize();

    const schemaSql = harness.calls.join("\n");
    expect(schemaSql).not.toContain("CREATE TABLE IF NOT EXISTS course_progress");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS journey_drafts");
    expect(harness.calls).toContain("PRAGMA user_version = 2");
  });

  test("rejects a database created by a future app version without mutating it", async () => {
    const harness = makeHarness({ databaseExists: true, key: VALID_DATABASE_KEY, userVersion: 3 });
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );

    await expect(manager.initialize()).rejects.toThrow("Unsupported database version: 3");
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
});

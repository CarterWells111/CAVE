import {
  createEncryptedDatabaseManager,
  type DatabaseTransactionConnection,
  DatabaseRecoveryRequiredError,
  LocalDataDeletionInProgressError
} from "./database";
import { CURRENT_SCHEMA_VERSION, DATABASE_MIGRATIONS } from "./migrations";

const VALID_DATABASE_KEY = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";
const TRANSACTION_CONTROL_SQL = [
  "BEGIN",
  " \n-- leading comment\n BeGiN immediate transaction ; /* trailing comment */ ",
  "/* leading comment */ cOmMiT TRANSACTION; -- trailing comment",
  "\t-- leading comment\r\n EnD ;\n",
  "/* leading comment */ RoLlBaCk transaction /* trailing comment */ ; ",
  "-- leading comment\n SaVePoInT migration_guard ;",
  "/* leading comment */ ReLeAsE SAVEPOINT migration_guard;",
  " RoLlBaCk TRANSACTION TO SAVEPOINT migration_guard; -- trailing comment",
  "SAVEPOINT \"migration guard\"",
  "ROLLBACK TO SAVEPOINT \"migration guard\"",
  "RELEASE SAVEPOINT \"migration guard\"",
  "SAVEPOINT \"a;b\""
];
const DATA_SQL_WITH_CONTROL_WORDS = [
  "SELECT 'note; COMMIT later'",
  "SELECT 'SAVEPOINT not control'",
  "SELECT 'it''s; ROLLBACK later'",
  "SELECT \"COMMIT \"\"quoted\"\"; identifier\" FROM drafts",
  "SELECT `ROLLBACK; identifier` FROM drafts",
  "SELECT [SAVEPOINT; identifier] FROM drafts",
  "SELECT 1 /* ; COMMIT */",
  "SELECT 1 -- ; RELEASE guarded"
];

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((settle) => { resolve = settle; });
  return { promise, resolve };
}

function makeHarness(options: {
  databaseExists?: boolean;
  key?: string | null;
  failVersionOnce?: boolean;
  failSqlOnce?: string;
  userVersion?: number;
  advanceVersionOnBegin?: number;
  advanceVersionOnBeginCall?: number;
  existingTables?: string[];
} = {}) {
  let exists = options.databaseExists ?? false;
  let key = options.key ?? null;
  let failVersionOnce = options.failVersionOnce ?? false;
  const failSqlQueue = options.failSqlOnce === undefined ? [] : [options.failSqlOnce];
  let userVersion = options.userVersion ?? 0;
  let beginCount = 0;
  const tables = new Set(options.existingTables ?? []);
  let transactionTables: Set<string> | null = null;
  const calls: string[] = [];
  const database = {
    execAsync: jest.fn(async (sql: string) => {
      calls.push(sql);
      if (sql === "BEGIN IMMEDIATE") {
        beginCount += 1;
        transactionTables = new Set(tables);
        if (
          options.advanceVersionOnBegin !== undefined
          && beginCount === (options.advanceVersionOnBeginCall ?? 1)
        ) {
          userVersion = options.advanceVersionOnBegin;
        }
      }
      if (sql === failSqlQueue[0]) {
        failSqlQueue.shift();
        throw new Error("migration write failed");
      }
      for (const match of sql.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z0-9_]+)/gu)) {
        if (match[1] !== undefined) tables.add(match[1]);
      }
      if (sql === "COMMIT") transactionTables = null;
      if (sql === "ROLLBACK" && transactionTables !== null) {
        tables.clear();
        for (const table of transactionTables) tables.add(table);
        transactionTables = null;
      }
      const version = /^PRAGMA user_version = (\d+)$/u.exec(sql);
      if (version?.[1] !== undefined) userVersion = Number(version[1]);
    }),
    runAsync: jest.fn(async (sql: string) => {
      void sql;
      return { changes: 0 };
    }),
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
    hasPendingLocalDataDeletion: jest.fn(async () => false),
    deleteAllSecrets: jest.fn(async () => { key = null; })
  };
  const files = {
    databaseExists: jest.fn(async () => exists),
    removeDatabaseFiles: jest.fn(async () => { exists = false; calls.push("remove-files"); })
  };
  const native = { openDatabaseAsync: jest.fn(async () => { exists = true; calls.push("open"); return database; }) };
  return {
    calls,
    database,
    failNextSql: (...sql: string[]) => { failSqlQueue.push(...sql); },
    files,
    native,
    secrets,
    tables
  };
}

let coordinationKeySequence = 0;

function makeCoordinatedLifecycleHarness(options: { blockFirstClose?: boolean } = {}) {
  let exists = false;
  let key: string | null = null;
  let openSequence = 0;
  const coordinationKey = `database-test-${++coordinationKeySequence}`;
  const closeStarted = deferred();
  const allowClose = deferred();
  const events: string[] = [];

  function createDependencies(label: string) {
    const connection = {
      execAsync: jest.fn(async () => undefined),
      runAsync: jest.fn(async () => ({ changes: 0 })),
      getAllAsync: jest.fn(async () => []),
      getFirstAsync: jest.fn(async () => ({ user_version: 7 })),
      closeAsync: jest.fn(async () => {
        events.push(`${label}:close-start`);
        closeStarted.resolve();
        if (options.blockFirstClose === true) await allowClose.promise;
        events.push(`${label}:close-end`);
      })
    };
    const native = {
      openDatabaseAsync: jest.fn(async () => {
        openSequence += 1;
        exists = true;
        events.push(`${label}:open:${openSequence}`);
        return connection;
      })
    };
    const files = {
      coordinationKey,
      databaseExists: jest.fn(async () => exists),
      removeDatabaseFiles: jest.fn(async () => {
        events.push(`${label}:remove`);
        exists = false;
      })
    };
    const secrets = {
      getDatabaseKey: jest.fn(async () => key),
      getOrCreateDatabaseKey: jest.fn(async () => {
        if (key === null) key = VALID_DATABASE_KEY;
        return key;
      }),
      getOrCreateInstallationToken: jest.fn(async () => "token"),
      deleteDatabaseKey: jest.fn(async () => { key = null; }),
      hasPendingLocalDataDeletion: jest.fn(async () => false),
      deleteAllSecrets: jest.fn(async () => { key = null; })
    };
    return { connection, files, native, secrets };
  }

  return {
    allowClose,
    closeStarted,
    events,
    first: createDependencies("first"),
    second: createDependencies("second")
  };
}

function makeLifecycleHarness() {
  let openSequence = 0;
  const firstReadStarted = deferred();
  const allowFirstRead = deferred();
  const events: string[] = [];

  function createConnection(id: number) {
    let firstRead = true;
    return {
      execAsync: jest.fn(async () => undefined),
      runAsync: jest.fn(async () => ({ changes: 0 })),
      getAllAsync: jest.fn(async () => []),
      getFirstAsync: jest.fn(async () => {
        if (id === 1 && firstRead) {
          firstRead = false;
          firstReadStarted.resolve();
          await allowFirstRead.promise;
        }
        return { user_version: 7 };
      }),
      closeAsync: jest.fn(async () => { events.push(`close:${id}`); })
    };
  }

  const native = {
    openDatabaseAsync: jest.fn(async () => {
      const id = ++openSequence;
      events.push(`open:${id}`);
      return createConnection(id);
    })
  };
  const files = {
    databaseExists: jest.fn(async () => true),
    removeDatabaseFiles: jest.fn(async () => { events.push("remove"); })
  };
  const secrets = {
    getDatabaseKey: jest.fn(async () => VALID_DATABASE_KEY),
    getOrCreateDatabaseKey: jest.fn(async () => VALID_DATABASE_KEY),
    getOrCreateInstallationToken: jest.fn(async () => "token"),
    deleteDatabaseKey: jest.fn(async () => undefined),
    hasPendingLocalDataDeletion: jest.fn(async () => false),
    deleteAllSecrets: jest.fn(async () => undefined)
  };
  return {
    allowFirstRead,
    dependencies: { native, files, secrets },
    events,
    firstReadStarted
  };
}

describe("encrypted database lifecycle", () => {
  test("keeps the shared migration registry contiguous through the current version", () => {
    expect(DATABASE_MIGRATIONS.map(({ version }) => version)).toEqual(
      Array.from({ length: CURRENT_SCHEMA_VERSION }, (_, index) => index + 1)
    );
  });

  test("applies key before any schema access, then enables integrity pragmas", async () => {
    const harness = makeHarness();
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    await manager.initialize();

    expect(harness.calls.slice(0, 7)).toEqual([
      "open",
      `PRAGMA key = '${VALID_DATABASE_KEY}'`,
      "PRAGMA foreign_keys = ON",
      "PRAGMA journal_mode = WAL",
      "BEGIN IMMEDIATE",
      "PRAGMA user_version",
      "COMMIT"
    ]);
    expect(harness.calls.findIndex((call) => call.includes("CREATE TABLE"))).toBeGreaterThan(6);
    expect(harness.calls.join("\n")).not.toContain("transcript_history");
  });

  test("migrates a new encrypted database through v1-v7 without replacing tables", async () => {
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
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS app_preferences");
    expect(schemaSql).toContain("theme_preference IN ('system', 'light', 'dark')");
    expect(harness.calls.filter((call) => call.startsWith("PRAGMA user_version ="))).toEqual([
      "PRAGMA user_version = 1",
      "PRAGMA user_version = 2",
      "PRAGMA user_version = 3",
      "PRAGMA user_version = 4",
      "PRAGMA user_version = 5",
      "PRAGMA user_version = 6",
      "PRAGMA user_version = 7"
    ]);
  });

  test("applies v2 through v7 when opening a v1 database", async () => {
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
      "PRAGMA user_version = 6",
      "PRAGMA user_version = 7"
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
    expect(harness.calls).toContain("PRAGMA user_version = 7");
  });

  test("applies the v3 migration in its own transaction", async () => {
    const harness = makeHarness({ databaseExists: true, key: VALID_DATABASE_KEY, userVersion: 2 });

    await createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    ).initialize();

    const schema = harness.calls.findIndex((call) => call.includes("journey_drafts_v2"));
    const begin = harness.calls.lastIndexOf("BEGIN IMMEDIATE", schema);
    const version = harness.calls.indexOf("PRAGMA user_version = 3");
    const commit = harness.calls.indexOf("COMMIT", version);
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
    expect(harness.calls).toContain("PRAGMA user_version = 7");
    const schema = harness.calls.findIndex((call) => call.includes("app_shell_state"));
    const begin = harness.calls.lastIndexOf("BEGIN IMMEDIATE", schema);
    const version = harness.calls.indexOf("PRAGMA user_version = 4");
    const commit = harness.calls.indexOf("COMMIT", version);
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
    expect(harness.calls).toContain("PRAGMA user_version = 7");
  });

  test("adds the schema-v3 draft table when opening a v5 database", async () => {
    const harness = makeHarness({ databaseExists: true, key: VALID_DATABASE_KEY, userVersion: 5 });

    await createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    ).initialize();

    const schemaSql = harness.calls.join("\n");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS journey_drafts_v3");
    expect(schemaSql).toContain("CHECK (schema_version = 3)");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS app_preferences");
    expect(schemaSql).not.toContain("DROP TABLE");
    expect(schemaSql.indexOf("CREATE TABLE IF NOT EXISTS app_preferences"))
      .toBeLessThan(schemaSql.indexOf("CREATE TABLE IF NOT EXISTS journey_drafts_v3"));
    expect(harness.calls.filter((call) => call.startsWith("PRAGMA user_version =")))
      .toEqual(["PRAGMA user_version = 6", "PRAGMA user_version = 7"]);
  });

  test("upgrades a published main v6 preferences database by adding only v7 draft storage", async () => {
    const harness = makeHarness({
      databaseExists: true,
      key: VALID_DATABASE_KEY,
      userVersion: 6,
      existingTables: ["app_preferences"]
    });

    await createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    ).initialize();

    const schemaSql = harness.calls.join("\n");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS journey_drafts_v3");
    expect(schemaSql).toContain("CHECK (schema_version = 3)");
    expect(schemaSql).not.toContain("CREATE TABLE IF NOT EXISTS app_preferences");
    expect(harness.tables).toEqual(new Set(["app_preferences", "journey_drafts_v3"]));
    expect(harness.calls.filter((call) => call.startsWith("PRAGMA user_version =")))
      .toEqual(["PRAGMA user_version = 7"]);
  });

  test("rolls back a failed published v6 preferences migration, then applies v7 once", async () => {
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

    expect(harness.calls.filter((call) => call.includes("CREATE TABLE IF NOT EXISTS app_preferences")))
      .toHaveLength(2);
    expect(harness.calls.filter((call) => call === "PRAGMA user_version = 6")).toHaveLength(2);
    expect(harness.calls.filter((call) => call.includes("CREATE TABLE IF NOT EXISTS journey_drafts_v3")))
      .toHaveLength(1);
    expect(harness.calls.filter((call) => call === "PRAGMA user_version = 7")).toHaveLength(1);
    expect(harness.calls.slice(-3)).toEqual(["BEGIN IMMEDIATE", "PRAGMA user_version", "COMMIT"]);
  });

  test("rejects a database created by a future app version without mutating it", async () => {
    const harness = makeHarness({ databaseExists: true, key: VALID_DATABASE_KEY, userVersion: 8 });
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );

    await expect(manager.initialize()).rejects.toThrow("Unsupported database version: 8");
    expect(harness.calls.join("\n")).not.toContain("CREATE TABLE");
    expect(harness.calls).not.toContain("PRAGMA user_version = 2");
    expect(harness.files.removeDatabaseFiles).not.toHaveBeenCalled();
  });

  test("reads an initially current schema under a write lock before accepting it", async () => {
    const harness = makeHarness({
      databaseExists: true,
      key: VALID_DATABASE_KEY,
      userVersion: 7,
      advanceVersionOnBegin: 8
    });
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );

    await expect(manager.initialize()).rejects.toThrow("Unsupported database version: 8");
    expect(harness.calls).toContain("BEGIN IMMEDIATE");
    expect(harness.calls).toContain("ROLLBACK");
    expect(harness.files.removeDatabaseFiles).not.toHaveBeenCalled();
  });

  test("skips stale migration work when the locked version has already advanced", async () => {
    const harness = makeHarness({
      databaseExists: true,
      key: VALID_DATABASE_KEY,
      userVersion: 0,
      advanceVersionOnBegin: 7,
      advanceVersionOnBeginCall: 2
    });

    await createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    ).initialize();

    expect(harness.calls.filter((call) => call.includes("CREATE TABLE"))).toHaveLength(0);
    expect(harness.calls.filter((call) => call.startsWith("PRAGMA user_version ="))).toHaveLength(0);
    expect(harness.calls.filter((call) => call === "PRAGMA user_version")).toHaveLength(2);
  });

  test("preserves an apparently orphaned key when database inspection reports absent", async () => {
    const harness = makeHarness({ databaseExists: false, key: VALID_DATABASE_KEY });
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );

    await expect(manager.initialize()).rejects.toMatchObject({
      name: "DatabaseRecoveryRequiredError",
      reason: "missing-database"
    });
    expect(harness.files.removeDatabaseFiles).not.toHaveBeenCalled();
    expect(harness.secrets.deleteDatabaseKey).not.toHaveBeenCalled();
    expect(harness.secrets.getOrCreateDatabaseKey).not.toHaveBeenCalled();
    expect(harness.native.openDatabaseAsync).not.toHaveBeenCalled();
  });

  test("preserves a database without a key and requires explicit recovery", async () => {
    const harness = makeHarness({ databaseExists: true, key: null });
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );

    await expect(manager.initialize()).rejects.toMatchObject({
      name: "DatabaseRecoveryRequiredError",
      code: "DATABASE_RECOVERY_REQUIRED",
      reason: "missing-key"
    });
    expect(harness.files.removeDatabaseFiles).not.toHaveBeenCalled();
    expect(harness.secrets.deleteDatabaseKey).not.toHaveBeenCalled();
    expect(harness.secrets.getOrCreateDatabaseKey).not.toHaveBeenCalled();
    expect(harness.native.openDatabaseAsync).not.toHaveBeenCalled();
  });

  test("preserves a database with an invalid encoded key and requires explicit recovery", async () => {
    const harness = makeHarness({ databaseExists: true, key: "corrupted-key" });
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );

    await expect(manager.initialize()).rejects.toMatchObject({
      name: "DatabaseRecoveryRequiredError",
      code: "DATABASE_RECOVERY_REQUIRED",
      reason: "invalid-key"
    });
    expect(harness.files.removeDatabaseFiles).not.toHaveBeenCalled();
    expect(harness.secrets.deleteDatabaseKey).not.toHaveBeenCalled();
    expect(harness.native.openDatabaseAsync).not.toHaveBeenCalled();
  });

  test("preserves database and key after a SQLCipher key mismatch", async () => {
    const harness = makeHarness({
      databaseExists: true,
      key: VALID_DATABASE_KEY,
      failVersionOnce: true
    });
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );

    await expect(manager.initialize()).rejects.toMatchObject({
      name: "DatabaseRecoveryRequiredError",
      code: "DATABASE_RECOVERY_REQUIRED",
      reason: "key-mismatch"
    });
    expect(harness.database.closeAsync).toHaveBeenCalledTimes(1);
    expect(harness.files.removeDatabaseFiles).not.toHaveBeenCalled();
    expect(harness.secrets.deleteDatabaseKey).not.toHaveBeenCalled();
    expect(harness.native.openDatabaseAsync).toHaveBeenCalledTimes(1);
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

  test("exports a structured recovery error for callers to discriminate", () => {
    const error = new DatabaseRecoveryRequiredError("missing-key");

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: "DatabaseRecoveryRequiredError",
      code: "DATABASE_RECOVERY_REQUIRED",
      reason: "missing-key"
    });
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
    expect(harness.calls.filter((call) => call === "PRAGMA user_version")).toHaveLength(8);
    expect(harness.calls.filter((call) => call.includes("CREATE TABLE"))).toHaveLength(7);
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

    await expect(manager.initialize()).resolves.toBeDefined();
    expect(harness.native.openDatabaseAsync).toHaveBeenCalledTimes(2);
  });

  test("coalesces fresh initialization across managers with distinct adapter wrappers", async () => {
    const harness = makeCoordinatedLifecycleHarness();
    const first = createEncryptedDatabaseManager(
      harness.first as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    const second = createEncryptedDatabaseManager(
      harness.second as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );

    const [firstConnection, secondConnection] = await Promise.all([
      first.initialize(),
      second.initialize()
    ]);

    expect(firstConnection).toBe(secondConnection);
    expect(harness.first.secrets.getOrCreateDatabaseKey.mock.calls.length
      + harness.second.secrets.getOrCreateDatabaseKey.mock.calls.length).toBe(1);
    expect(harness.first.native.openDatabaseAsync.mock.calls.length
      + harness.second.native.openDatabaseAsync.mock.calls.length).toBe(1);
  });

  test("coalesces managers that share native and file adapter objects without a stable key", async () => {
    const harness = makeHarness();
    const dependencies = harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0];
    const first = createEncryptedDatabaseManager(dependencies);
    const second = createEncryptedDatabaseManager(dependencies);

    const [firstConnection, secondConnection] = await Promise.all([
      first.initialize(),
      second.initialize()
    ]);

    expect(firstConnection).toBe(secondConnection);
    expect(harness.secrets.getOrCreateDatabaseKey).toHaveBeenCalledTimes(1);
    expect(harness.native.openDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  test("preserves a key mismatch when close fails and retries the pending close", async () => {
    const harness = makeHarness({
      databaseExists: true,
      key: VALID_DATABASE_KEY,
      failVersionOnce: true
    });
    const closeError = new Error("close after mismatch failed");
    harness.database.closeAsync.mockRejectedValueOnce(closeError);
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );

    const recovery = await manager.initialize().catch((error: unknown) => error);

    expect(recovery).toMatchObject({
      name: "DatabaseRecoveryRequiredError",
      code: "DATABASE_RECOVERY_REQUIRED",
      reason: "key-mismatch",
      cause: expect.objectContaining({
        message: "file is encrypted",
        cause: closeError
      })
    });
    await expect(manager.initialize()).resolves.toBeDefined();
    expect(harness.database.closeAsync).toHaveBeenCalledTimes(2);
    expect(harness.native.openDatabaseAsync).toHaveBeenCalledTimes(2);
  });

  test("remove closes the shared connection and leaves a key mismatch fail closed", async () => {
    const harness = makeCoordinatedLifecycleHarness({ blockFirstClose: true });
    const first = createEncryptedDatabaseManager(
      harness.first as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    const second = createEncryptedDatabaseManager(
      harness.second as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    await first.initialize();

    const removing = first.removeDatabaseFiles();
    await harness.closeStarted.promise;
    const reopening = second.initialize();
    await Promise.resolve();

    expect(harness.events).toEqual(["first:open:1", "first:close-start"]);
    expect(harness.second.native.openDatabaseAsync).not.toHaveBeenCalled();

    harness.allowClose.resolve();
    await removing;
    await expect(reopening).rejects.toMatchObject({ reason: "missing-database" });

    expect(harness.events).toEqual([
      "first:open:1",
      "first:close-start",
      "first:close-end",
      "first:remove"
    ]);
  });

  test("serializes a close and later initialize behind an in-flight initialize", async () => {
    const harness = makeLifecycleHarness();
    const manager = createEncryptedDatabaseManager(
      harness.dependencies as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    const first = manager.initialize();
    await harness.firstReadStarted.promise;

    const closing = manager.close();
    const reopened = manager.initialize();
    harness.allowFirstRead.resolve();
    const [firstConnection, , reopenedConnection] = await Promise.all([first, closing, reopened]);

    expect(reopenedConnection).not.toBe(firstConnection);
    expect(harness.events).toEqual(["open:1", "close:1", "open:2"]);
  });

  test("serializes remove behind initialize, closes the connection, then permits reopen", async () => {
    const harness = makeLifecycleHarness();
    const manager = createEncryptedDatabaseManager(
      harness.dependencies as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    const first = manager.initialize();
    await harness.firstReadStarted.promise;

    const removing = manager.removeDatabaseFiles();
    const reopened = manager.initialize();
    harness.allowFirstRead.resolve();
    await Promise.all([first, removing, reopened]);

    expect(harness.events).toEqual(["open:1", "close:1", "remove", "open:2"]);
  });

  test("invalidates a retained handle after close without affecting the reopened generation", async () => {
    const harness = makeHarness({
      databaseExists: true,
      key: VALID_DATABASE_KEY,
      userVersion: 7
    });
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    const retained = await manager.initialize();

    await manager.close();

    await expect(retained.getFirstAsync("SELECT 1")).rejects.toThrow(
      "Database connection is no longer active"
    );
    const reopened = await manager.initialize();
    await expect(reopened.getFirstAsync("SELECT 1")).resolves.toBeDefined();
    await expect(retained.getFirstAsync("SELECT 1")).rejects.toThrow(
      "Database connection is no longer active"
    );
  });

  test.each([
    ["file removal", (manager: ReturnType<typeof createEncryptedDatabaseManager>) =>
      manager.removeDatabaseFiles()],
    ["exclusive maintenance", (manager: ReturnType<typeof createEncryptedDatabaseManager>) =>
      manager.withExclusiveMaintenance(async () => undefined)]
  ] as const)("invalidates a retained handle after %s", async (_label, maintain) => {
    const harness = makeHarness();
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    const retained = await manager.initialize();

    await maintain(manager);

    await expect(retained.runAsync("UPDATE drafts SET updated_at = ?", "now"))
      .rejects.toThrow("Database connection is no longer active");
  });

  test("does not reuse a connection whose close failed", async () => {
    const harness = makeHarness({ databaseExists: true, key: VALID_DATABASE_KEY, userVersion: 7 });
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    const retained = await manager.initialize();
    const closeError = new Error("close failed");
    harness.database.closeAsync.mockRejectedValueOnce(closeError);

    await expect(manager.close()).rejects.toBe(closeError);
    await expect(retained.getAllAsync("SELECT * FROM drafts")).rejects.toThrow(
      "Database connection is no longer active"
    );
    const reopened = await manager.initialize();
    await expect(reopened.getAllAsync("SELECT * FROM drafts")).resolves.toBeDefined();
    await expect(retained.getAllAsync("SELECT * FROM drafts")).rejects.toThrow(
      "Database connection is no longer active"
    );

    expect(harness.database.closeAsync).toHaveBeenCalledTimes(2);
    expect(harness.native.openDatabaseAsync).toHaveBeenCalledTimes(2);
  });

  test("refuses to initialize while durable local-data deletion is pending", async () => {
    const harness = makeHarness();
    harness.secrets.hasPendingLocalDataDeletion.mockResolvedValue(true);
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );

    await expect(manager.initialize()).rejects.toBeInstanceOf(
      LocalDataDeletionInProgressError
    );

    expect(harness.secrets.getDatabaseKey).not.toHaveBeenCalled();
    expect(harness.native.openDatabaseAsync).not.toHaveBeenCalled();
  });

  test("blocks a cached connection and retained handle after deletion becomes pending", async () => {
    const harness = makeHarness();
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    const connection = await manager.initialize();
    harness.secrets.hasPendingLocalDataDeletion.mockResolvedValue(true);

    await expect(manager.initialize()).rejects.toBeInstanceOf(
      LocalDataDeletionInProgressError
    );
    await expect(connection.getFirstAsync("SELECT 1")).rejects.toBeInstanceOf(
      LocalDataDeletionInProgressError
    );
  });

  test("retries a failed native close before exclusive maintenance can erase storage", async () => {
    const harness = makeHarness({ databaseExists: true, key: VALID_DATABASE_KEY, userVersion: 7 });
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    await manager.initialize();
    const closeError = new Error("close failed");
    harness.database.closeAsync.mockRejectedValueOnce(closeError);
    const maintenanceOperation = jest.fn(async () => undefined);

    await expect(manager.withExclusiveMaintenance(maintenanceOperation)).rejects.toBe(closeError);
    expect(maintenanceOperation).not.toHaveBeenCalled();
    await expect(manager.withExclusiveMaintenance(maintenanceOperation)).resolves.toBeUndefined();

    expect(harness.database.closeAsync).toHaveBeenCalledTimes(2);
    expect(maintenanceOperation).toHaveBeenCalledTimes(1);
  });

  test("waits for an active tracked query before entering exclusive maintenance", async () => {
    const harness = makeHarness();
    const queryStarted = deferred();
    const allowQuery = deferred();
    harness.database.getFirstAsync.mockImplementation(async (sql: string) => {
      if (sql === "SELECT blocked") {
        queryStarted.resolve();
        await allowQuery.promise;
        return { user_version: 0 };
      }
      return { user_version: 0 };
    });
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    const connection = await manager.initialize();
    const query = connection.getFirstAsync("SELECT blocked");
    await queryStarted.promise;
    const maintenanceOperation = jest.fn(async () => undefined);
    const maintenance = manager.withExclusiveMaintenance(maintenanceOperation);
    await Promise.resolve();

    expect(maintenanceOperation).not.toHaveBeenCalled();
    allowQuery.resolve();
    await Promise.all([query, maintenance]);
    expect(maintenanceOperation).toHaveBeenCalledTimes(1);
  });

  test("does not expose execAsync on a managed connection", async () => {
    const harness = makeHarness();
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    const connection = await manager.initialize();

    for (const sql of [
      "UPDATE journey_drafts_v3 SET updated_at = 'now'; COMMIT",
      "/* retained handle */ COMMIT"
    ]) {
      expect(() => (
        connection as unknown as { execAsync(statement: string): Promise<void> }
      ).execAsync(sql)).toThrow(TypeError);
    }
    expect(connection).not.toHaveProperty("execAsync");
  });

  test("does not expose closeAsync on a managed connection", async () => {
    const harness = makeHarness();
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    const connection = await manager.initialize();

    expect(() => (
      connection as unknown as { closeAsync(): Promise<void> }
    ).closeAsync()).toThrow(TypeError);
    expect(connection).not.toHaveProperty("closeAsync");
    await expect(manager.close()).resolves.toBeUndefined();
  });

  test("rejects transaction-control SQL through every managed SQL method", async () => {
    const harness = makeHarness();
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    const connection = await manager.initialize();
    const operations = [
      (sql: string) => connection.runAsync(sql),
      (sql: string) => connection.getAllAsync(sql),
      (sql: string) => connection.getFirstAsync(sql)
    ];

    for (const operation of operations) {
      for (const sql of TRANSACTION_CONTROL_SQL) {
        await expect(operation(sql)).rejects.toThrow(
          "Transaction-control SQL is not allowed"
        );
      }
    }
    await expect(connection.runAsync("UPDATE drafts SET updated_at = ?", "now"))
      .resolves.toBeDefined();
    await expect(connection.getAllAsync("SELECT * FROM drafts"))
      .resolves.toBeDefined();
    await expect(connection.getFirstAsync("SELECT * FROM drafts LIMIT 1"))
      .resolves.toBeDefined();
    for (const operation of operations) {
      for (const sql of DATA_SQL_WITH_CONTROL_WORDS) {
        await expect(operation(sql)).resolves.toBeDefined();
      }
    }
  });

  test("gives one transaction token exclusive access until the callback commits", async () => {
    const harness = makeHarness({
      databaseExists: true,
      key: VALID_DATABASE_KEY,
      userVersion: 7
    });
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    const retainedConnection = await manager.initialize();
    const transactionStarted = deferred();
    const allowTransaction = deferred();
    const transaction = manager.withTransaction(async (connection) => {
      transactionStarted.resolve();
      await allowTransaction.promise;
      await connection.runAsync(
        "UPDATE journey_drafts_v3 SET updated_at = ?",
        "now"
      );
      return "committed";
    });
    await transactionStarted.promise;
    const maintenanceOperation = jest.fn(async () => undefined);
    const maintenance = manager.withExclusiveMaintenance(maintenanceOperation);
    await Promise.resolve();

    expect(maintenanceOperation).not.toHaveBeenCalled();
    await expect(retainedConnection.getFirstAsync("SELECT 1")).rejects.toThrow(
      "Database transaction is in progress"
    );
    allowTransaction.resolve();
    await expect(transaction).resolves.toBe("committed");
    await maintenance;

    expect(maintenanceOperation).toHaveBeenCalledTimes(1);
    expect(harness.database.runAsync).toHaveBeenCalledWith(
      "UPDATE journey_drafts_v3 SET updated_at = ?",
      "now"
    );
    expect(harness.calls.slice(-3)).toEqual(["BEGIN IMMEDIATE", "COMMIT", "close"]);
  });

  test.each(["callback", "commit"] as const)(
    "rolls back and releases the transaction lease after a %s failure",
    async (failure) => {
      const harness = makeHarness({
        databaseExists: true,
        key: VALID_DATABASE_KEY,
        userVersion: 7
      });
      const manager = createEncryptedDatabaseManager(
        harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
      );
      await manager.initialize();
      const transactionError = new Error(`${failure} failed`);
      if (failure === "commit") harness.failNextSql("COMMIT");
      const transactionCallStart = harness.calls.length;

      await expect(manager.withTransaction(async () => {
        if (failure === "callback") throw transactionError;
        return undefined;
      })).rejects.toThrow(failure === "callback" ? transactionError.message : "migration write failed");

      expect(harness.calls.slice(transactionCallStart)).toEqual(["BEGIN IMMEDIATE", "COMMIT", "ROLLBACK"]
        .filter((sql) => failure === "commit" || sql !== "COMMIT"));
      await expect(manager.withExclusiveMaintenance(async () => undefined))
        .resolves.toBeUndefined();
    }
  );

  test("poisons the connection when commit and rollback both fail", async () => {
    const harness = makeHarness({
      databaseExists: true,
      key: VALID_DATABASE_KEY,
      userVersion: 7
    });
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    const retained = await manager.initialize();
    harness.failNextSql("COMMIT", "ROLLBACK");

    await expect(manager.withTransaction(async () => undefined)).rejects.toThrow(
      "migration write failed"
    );
    await expect(retained.getFirstAsync("SELECT 1")).rejects.toThrow(
      "Database connection is no longer active"
    );
    const reopened = await manager.initialize();
    await expect(reopened.getFirstAsync("SELECT 1")).resolves.toBeDefined();
    await expect(retained.getFirstAsync("SELECT 1")).rejects.toThrow(
      "Database connection is no longer active"
    );

    expect(harness.database.closeAsync).toHaveBeenCalledTimes(1);
    expect(harness.native.openDatabaseAsync).toHaveBeenCalledTimes(2);
  });

  test("rolls back when a transaction callback rejects with undefined", async () => {
    const harness = makeHarness({
      databaseExists: true,
      key: VALID_DATABASE_KEY,
      userVersion: 7
    });
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    await manager.initialize();
    const transactionCallStart = harness.calls.length;

    await expect(manager.withTransaction(async () => {
      throw undefined;
    })).rejects.toBeUndefined();

    expect(harness.calls.slice(transactionCallStart)).toEqual([
      "BEGIN IMMEDIATE",
      "ROLLBACK"
    ]);
  });

  test("rejects operations through an expired transaction token", async () => {
    const harness = makeHarness({
      databaseExists: true,
      key: VALID_DATABASE_KEY,
      userVersion: 7
    });
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    let expired: DatabaseTransactionConnection | null = null;

    await manager.withTransaction(async (transaction) => {
      expired = transaction;
    });

    await expect(expired!.getFirstAsync("SELECT 1")).rejects.toThrow(
      "Database transaction token is no longer active"
    );
  });

  test("does not expose execAsync on a transaction token", async () => {
    const harness = makeHarness({
      databaseExists: true,
      key: VALID_DATABASE_KEY,
      userVersion: 7
    });
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );

    await manager.withTransaction(async (transaction) => {
      for (const sql of [
        "UPDATE journey_drafts_v3 SET updated_at = 'now'; COMMIT",
        "-- transaction token\nROLLBACK"
      ]) {
        expect(() => (
          transaction as unknown as { execAsync(statement: string): Promise<void> }
        ).execAsync(sql)).toThrow(TypeError);
      }
      expect(transaction).not.toHaveProperty("execAsync");
    });
  });

  test("rejects transaction-control SQL through every transaction SQL method", async () => {
    const harness = makeHarness({
      databaseExists: true,
      key: VALID_DATABASE_KEY,
      userVersion: 7
    });
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );

    await expect(manager.withTransaction(async (transaction) => {
      const operations = [
        (sql: string) => transaction.runAsync(sql),
        (sql: string) => transaction.getAllAsync(sql),
        (sql: string) => transaction.getFirstAsync(sql)
      ];
      for (const operation of operations) {
        for (const sql of TRANSACTION_CONTROL_SQL) {
          await expect(operation(sql)).rejects.toThrow(
            "Transaction-control SQL is not allowed"
          );
        }
      }
    })).rejects.toThrow("Transaction-control SQL is not allowed");

    await expect(manager.withTransaction(async (transaction) => {
      await transaction.runAsync("UPDATE drafts SET updated_at = ?", "now");
      await transaction.getAllAsync("SELECT * FROM drafts");
      await transaction.getFirstAsync("SELECT * FROM drafts LIMIT 1");
      const operations = [
        (sql: string) => transaction.runAsync(sql),
        (sql: string) => transaction.getAllAsync(sql),
        (sql: string) => transaction.getFirstAsync(sql)
      ];
      for (const operation of operations) {
        for (const sql of DATA_SQL_WITH_CONTROL_WORDS) {
          await operation(sql);
        }
      }
    })).resolves.toBeUndefined();
  });

  test("serializes a second transaction behind the current token owner", async () => {
    const harness = makeHarness({
      databaseExists: true,
      key: VALID_DATABASE_KEY,
      userVersion: 7
    });
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    await manager.initialize();
    const firstStarted = deferred();
    const allowFirst = deferred();
    const first = manager.withTransaction(async () => {
      firstStarted.resolve();
      await allowFirst.promise;
    });
    await firstStarted.promise;
    const secondOperation = jest.fn(async () => undefined);
    const second = manager.withTransaction(secondOperation);
    await Promise.resolve();

    expect(secondOperation).not.toHaveBeenCalled();
    allowFirst.resolve();
    await Promise.all([first, second]);

    expect(secondOperation).toHaveBeenCalledTimes(1);
    expect(harness.calls.slice(-4)).toEqual([
      "BEGIN IMMEDIATE",
      "COMMIT",
      "BEGIN IMMEDIATE",
      "COMMIT"
    ]);
  });

  test("closes the token and waits for an unawaited operation before commit", async () => {
    const harness = makeHarness({
      databaseExists: true,
      key: VALID_DATABASE_KEY,
      userVersion: 7
    });
    const blockedStarted = deferred();
    const allowBlocked = deferred();
    harness.database.runAsync.mockImplementation(async (sql: string) => {
      if (sql === "UPDATE blocked") {
        blockedStarted.resolve();
        await allowBlocked.promise;
      }
      return { changes: 1 };
    });
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    await manager.initialize();
    const transactionCallStart = harness.calls.length;
    let retained: DatabaseTransactionConnection | null = null;

    const transaction = manager.withTransaction(async (connection) => {
      retained = connection;
      void connection.runAsync("UPDATE blocked");
      return "done";
    });
    await blockedStarted.promise;
    await Promise.resolve();

    expect(harness.calls.slice(transactionCallStart)).toEqual(["BEGIN IMMEDIATE"]);
    await expect(retained!.runAsync("UPDATE too-late")).rejects.toThrow(
      "Database transaction token is no longer active"
    );
    allowBlocked.resolve();
    await expect(transaction).resolves.toBe("done");
    expect(harness.calls.slice(transactionCallStart)).toEqual([
      "BEGIN IMMEDIATE",
      "COMMIT"
    ]);
  });

  test("waits for Promise.all siblings before rolling back an early rejection", async () => {
    const harness = makeHarness({
      databaseExists: true,
      key: VALID_DATABASE_KEY,
      userVersion: 7
    });
    const failure = new Error("first write failed");
    const siblingStarted = deferred();
    const allowSibling = deferred();
    const events: string[] = [];
    harness.database.runAsync.mockImplementation(async (sql: string) => {
      if (sql === "UPDATE fail-fast") throw failure;
      if (sql === "UPDATE blocked-sibling") {
        siblingStarted.resolve();
        await allowSibling.promise;
        events.push("sibling-settled");
      }
      return { changes: 1 };
    });
    const execImplementation = harness.database.execAsync.getMockImplementation();
    harness.database.execAsync.mockImplementation(async (sql: string) => {
      if (sql === "ROLLBACK") events.push("rollback");
      await execImplementation?.(sql);
    });
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    await manager.initialize();

    const transaction = manager.withTransaction(async (connection) => {
      await Promise.all([
        connection.runAsync("UPDATE fail-fast"),
        connection.runAsync("UPDATE blocked-sibling")
      ]);
    });
    await siblingStarted.promise;
    for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();

    expect(events).not.toContain("rollback");
    allowSibling.resolve();
    await expect(transaction).rejects.toBe(failure);
    expect(events).toEqual(["sibling-settled", "rollback"]);
  });

  test("rolls back when an unawaited transaction operation rejects", async () => {
    const harness = makeHarness({
      databaseExists: true,
      key: VALID_DATABASE_KEY,
      userVersion: 7
    });
    const failure = new Error("unawaited write failed");
    harness.database.runAsync.mockRejectedValueOnce(failure);
    const manager = createEncryptedDatabaseManager(
      harness as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    await manager.initialize();
    const transactionCallStart = harness.calls.length;

    const transaction = manager.withTransaction(async (connection) => {
      void connection.runAsync("UPDATE unawaited-failure");
    });

    await expect(transaction).rejects.toBe(failure);
    expect(harness.calls.slice(transactionCallStart)).toEqual([
      "BEGIN IMMEDIATE",
      "ROLLBACK"
    ]);
  });

  test("holds exclusive maintenance across key erasure and file removal", async () => {
    const harness = makeCoordinatedLifecycleHarness();
    const first = createEncryptedDatabaseManager(
      harness.first as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    const second = createEncryptedDatabaseManager(
      harness.second as unknown as Parameters<typeof createEncryptedDatabaseManager>[0]
    );
    await first.initialize();
    const maintenanceStarted = deferred();
    const allowMaintenance = deferred();

    const maintenance = first.withExclusiveMaintenance(async (exclusive) => {
      harness.events.push("maintenance-start");
      maintenanceStarted.resolve();
      await allowMaintenance.promise;
      await harness.first.secrets.deleteDatabaseKey();
      await exclusive.removeDatabaseFiles();
    });
    await maintenanceStarted.promise;
    const reopening = second.initialize();
    await Promise.resolve();

    expect(harness.second.native.openDatabaseAsync).not.toHaveBeenCalled();
    allowMaintenance.resolve();
    await Promise.all([maintenance, reopening]);
    expect(harness.events).toEqual([
      "first:open:1",
      "first:close-start",
      "first:close-end",
      "maintenance-start",
      "first:remove",
      "second:open:2"
    ]);
  });
});

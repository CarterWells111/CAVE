import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { JournalService } from "../application/journal-service";
import {
  createExpoGoJournalDatabaseManager,
  createExpoGoJournalRepository,
  type ExpoGoJournalDatabaseConnection,
  UnsupportedExpoGoJournalDatabaseVersionError,
} from "./expo-go-journal-repository";

function nodeSqliteDependencies(
  databasePath: string,
  opened: ExpoGoJournalDatabaseConnection[],
) {
  return {
    async openDatabaseAsync(): Promise<ExpoGoJournalDatabaseConnection> {
      const native = new DatabaseSync(databasePath);
      const connection: ExpoGoJournalDatabaseConnection = {
        async closeAsync() { native.close(); },
        async execAsync(sql) { native.exec(sql); },
        async runAsync(sql, ...params) {
          const result = native.prepare(sql).run(...params as never[]);
          return { changes: Number(result.changes) };
        },
        async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
          return native.prepare(sql).all(...params as never[]) as T[];
        },
        async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
          return native.prepare(sql).get(...params as never[]) as T | undefined ?? null;
        },
      };
      opened.push(connection);
      return connection;
    },
  };
}

async function closeAll(connections: ExpoGoJournalDatabaseConnection[]): Promise<void> {
  await Promise.all(connections.splice(0).map((connection) => connection.closeAsync()));
}

function databaseConnection(userVersion = 0): ExpoGoJournalDatabaseConnection {
  const database = {
    closeAsync: jest.fn(async () => undefined),
    execAsync: jest.fn(async () => undefined),
    runAsync: jest.fn(async () => ({ changes: 0 })),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async (sql: string) => (
      sql === "PRAGMA user_version" ? { user_version: userVersion } : null
    )),
  };
  return database as ExpoGoJournalDatabaseConnection;
}

test("closes a failed migration handle and allows a clean retry", async () => {
  const unsupported = databaseConnection(3);
  const supported = databaseConnection(0);
  const openDatabaseAsync = jest.fn()
    .mockResolvedValueOnce(unsupported)
    .mockResolvedValueOnce(supported);
  const manager = createExpoGoJournalDatabaseManager({ openDatabaseAsync });

  await expect(manager.initialize()).rejects.toBeInstanceOf(
    UnsupportedExpoGoJournalDatabaseVersionError,
  );
  expect(unsupported.closeAsync).toHaveBeenCalledTimes(1);

  await expect(manager.initialize()).resolves.toEqual(expect.objectContaining({
    runAsync: expect.any(Function),
  }));
  expect(openDatabaseAsync).toHaveBeenCalledTimes(2);
});

test("repository instances sharing one database dependency reuse initialization", async () => {
  const database = databaseConnection(1);
  const openDatabaseAsync = jest.fn(async () => database);
  const dependencies = { openDatabaseAsync };

  const first = createExpoGoJournalRepository(dependencies);
  const second = createExpoGoJournalRepository(dependencies);

  await first.listRecords("account-a");
  await second.listRecords("account-b");

  expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
});

test("serializes exclusive write transactions for the shared database manager", async () => {
  const database = databaseConnection(1);
  const manager = createExpoGoJournalDatabaseManager({
    openDatabaseAsync: jest.fn(async () => database),
  });
  await manager.initialize();

  let releaseFirst!: () => void;
  const firstCanFinish = new Promise<void>((resolve) => { releaseFirst = resolve; });
  let markFirstStarted!: () => void;
  const firstStarted = new Promise<void>((resolve) => { markFirstStarted = resolve; });
  (database.execAsync as jest.Mock).mockClear();
  let beginCalls = 0;
  (database.execAsync as jest.Mock).mockImplementation(async (sql: string) => {
    if (sql === "BEGIN IMMEDIATE") {
      beginCalls += 1;
    }
    if (sql === "BEGIN IMMEDIATE" && beginCalls === 1) {
      markFirstStarted();
      await firstCanFinish;
    }
  });

  const first = manager.withTransaction(async () => "first");
  const second = manager.withTransaction(async () => "second");
  await firstStarted;
  await Promise.resolve();

  expect(beginCalls).toBe(1);
  releaseFirst();
  await expect(Promise.all([first, second])).resolves.toEqual(["first", "second"]);
  expect(beginCalls).toBe(2);
});

test("uses the foreign-key-enabled primary connection for migrations and transactions", async () => {
  const database = databaseConnection(0);
  const separateConnectionTransaction = jest.fn(async () => {
    throw new Error("Expo SDK opened a separate transaction connection");
  });
  Object.assign(database, {
    withExclusiveTransactionAsync: separateConnectionTransaction,
  });
  const manager = createExpoGoJournalDatabaseManager({
    openDatabaseAsync: jest.fn(async () => database),
  });

  await expect(manager.initialize()).resolves.toEqual(expect.objectContaining({
    runAsync: expect.any(Function),
  }));
  await expect(manager.withTransaction(async (transaction) => {
    await transaction.runAsync("DELETE FROM journal_records WHERE id=?", "missing");
  })).resolves.toBeUndefined();

  const statements = (database.execAsync as jest.Mock).mock.calls.map(([sql]) => sql);
  expect(statements.indexOf("PRAGMA foreign_keys = ON")).toBeLessThan(
    statements.indexOf("BEGIN IMMEDIATE"),
  );
  expect(statements.indexOf("PRAGMA secure_delete = ON")).toBeLessThan(
    statements.indexOf("BEGIN IMMEDIATE"),
  );
  expect(statements).toContain("COMMIT");
  expect(separateConnectionTransaction).not.toHaveBeenCalled();
});

test("treats a busy WAL checkpoint as pending cleanup instead of success", async () => {
  const database = databaseConnection(1);
  (database.getFirstAsync as jest.Mock).mockImplementation(async (sql: string) => {
    if (sql === "PRAGMA user_version") return { user_version: 1 };
    if (sql.includes("journal_storage_state")) return { cleanup_pending: 1 };
    if (sql === "PRAGMA wal_checkpoint(TRUNCATE)") {
      return { busy: 1, log: 3, checkpointed: 1 };
    }
    return null;
  });
  const manager = createExpoGoJournalDatabaseManager({
    openDatabaseAsync: jest.fn(async () => database),
  }) as ReturnType<typeof createExpoGoJournalDatabaseManager> & {
    ensureDeletionCleanup(ownerAccountId: string): Promise<boolean>;
  };

  await manager.initialize();

  await expect(manager.ensureDeletionCleanup("account-a")).rejects.toThrow("journal-wal-checkpoint-busy");
  expect(database.runAsync).not.toHaveBeenCalledWith(
    expect.stringContaining("cleanup_pending=0"),
  );
});

test("keeps cleanup state and owner-marker read failures as raw storage errors", async () => {
  const ownerReadFailure = new Error("owner-marker-read-failed");
  const database = databaseConnection(2);
  (database.getFirstAsync as jest.Mock).mockImplementation(async (sql: string) => {
    if (sql === "PRAGMA user_version") return { user_version: 2 };
    if (sql.includes("journal_storage_state")) return { cleanup_pending: 0 };
    if (sql.includes("journal_cleared_owners")) throw ownerReadFailure;
    return null;
  });
  const manager = createExpoGoJournalDatabaseManager({
    openDatabaseAsync: jest.fn(async () => database),
  });

  await manager.initialize();
  await expect(manager.ensureDeletionCleanup?.("account-a")).rejects.toBe(
    ownerReadFailure,
  );
  expect(ownerReadFailure).not.toHaveProperty("cleanupPending");
});

test("does not label an unreadable cleanup marker as a pending committed deletion", async () => {
  const stateReadFailure = new Error("cleanup-state-read-failed");
  const database = databaseConnection(2);
  let cleanupStateReads = 0;
  (database.getFirstAsync as jest.Mock).mockImplementation(async (sql: string) => {
    if (sql === "PRAGMA user_version") return { user_version: 2 };
    if (sql.includes("journal_cleared_owners")) return null;
    if (sql.includes("journal_storage_state")) {
      cleanupStateReads += 1;
      if (cleanupStateReads === 1) return { cleanup_pending: 0 };
      throw stateReadFailure;
    }
    return null;
  });
  const manager = createExpoGoJournalDatabaseManager({
    openDatabaseAsync: jest.fn(async () => database),
  });

  await manager.initialize();
  await expect(manager.ensureDeletionCleanup?.("account-a")).rejects.toBe(
    stateReadFailure,
  );
  expect(stateReadFailure).not.toHaveProperty("cleanupPending");
});

test("keeps a durable cleanup marker when a real SQLite reader blocks WAL truncation", async () => {
  const databasePath = join(tmpdir(), `cave-expo-go-busy-${randomUUID()}.db`);
  const opened: ExpoGoJournalDatabaseConnection[] = [];
  let reader: DatabaseSync | null = null;
  try {
    const manager = createExpoGoJournalDatabaseManager(
      nodeSqliteDependencies(databasePath, opened),
    );
    const database = await manager.initialize();
    await database.runAsync(`INSERT INTO journal_records (
      id,owner_account_id,title,occurred_at,created_at,updated_at,editable_until,
      highlight_kind,highlight_text,body,topics_json,source_json,card_snapshot_json
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    "busy-record", "account-a", "待删除", "2026-08-29",
    "2026-08-29T10:00:00.000Z", "2026-08-29T10:00:00.000Z",
    "2026-08-30T10:00:00.000Z", "feeling", "安心", "敏感正文", "[]",
    '{"kind":"freeform"}', null);

    reader = new DatabaseSync(databasePath);
    reader.exec("BEGIN");
    reader.prepare("SELECT body FROM journal_records WHERE id=?").get("busy-record");

    await manager.withTransaction(async (transaction) => {
      await manager.markDeletionCleanupPending?.(transaction);
      await transaction.runAsync("DELETE FROM journal_records WHERE id=?", "busy-record");
    });

    await expect(manager.checkpointAfterDeletion?.()).rejects.toThrow(
      "journal-wal-checkpoint-busy",
    );
    await expect(opened[0]!.getFirstAsync<{ cleanup_pending: number }>(
      "SELECT cleanup_pending FROM journal_storage_state WHERE singleton_id=1",
    )).resolves.toEqual({ cleanup_pending: 1 });

    reader.exec("ROLLBACK");
    reader.close();
    reader = null;
    await expect(manager.ensureDeletionCleanup?.("account-a")).resolves.toBe(false);
  } finally {
    if (reader !== null) {
      try { reader.exec("ROLLBACK"); } catch { /* transaction may already be closed */ }
      reader.close();
    }
    await closeAll(opened);
    for (const suffix of ["", "-shm", "-wal"]) {
      rmSync(`${databasePath}${suffix}`, { force: true });
    }
  }
});

test("reopens an actual SQLite file with account-scoped records, entries and reviews intact", async () => {
  const databasePath = join(tmpdir(), `cave-expo-go-journal-${randomUUID()}.db`);
  const opened: ExpoGoJournalDatabaseConnection[] = [];
  let sequence = 0;
  let now = "2026-08-27T12:00:00.000Z";
  const service = (repository: ReturnType<typeof createExpoGoJournalRepository>, accountId: string) => (
    new JournalService(repository, {
      createId: () => `journal-${++sequence}`,
      now: () => now,
    }, accountId)
  );

  try {
    const firstRepository = createExpoGoJournalRepository(
      nodeSqliteDependencies(databasePath, opened),
    );
    const firstA = service(firstRepository, "account-a");
    const firstB = service(firstRepository, "account-b");
    const recordA = await firstA.createRecord({
      title: "A 的手记",
      occurredAt: "2026-08-27",
      highlight: { kind: "feeling", text: "安心" },
      body: "初始内容",
      source: { kind: "journey", journeyId: "private-journey", cardId: "private-card" },
      cardSnapshot: {
        cardId: "private-card",
        capturedAt: "2026-08-27T12:00:00.000Z",
        sections: [{ id: "need", text: "用户明确保存的卡片快照" }],
      },
    });
    await firstB.createRecord({
      title: "B 的手记",
      occurredAt: "2026-08-26",
      highlight: { kind: "impression", text: "清晰" },
    });
    const entry = await firstA.addEntry(recordA.id, {
      kind: "insight",
      occurredAt: "2026-08-27",
      body: "补充记录",
    });
    const reviewA = await firstA.savePeriodReview({
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-08-31T23:59:59.999Z",
      title: "八月回顾",
      body: "阶段回顾",
      sourceRecordIds: [recordA.id],
    });
    await expect(firstRepository.savePeriodReview("account-b", {
      ...reviewA,
      title: "B 尝试覆盖 A",
      body: "不应成功",
    })).rejects.toThrow("journal-period-review-owner-conflict");
    now = "2026-08-27T13:00:00.000Z";
    await firstA.updateRecord(recordA.id, { body: "更新后的内容" });
    await firstA.updateEntry(entry.id, { body: "更新后的补充" });
    await closeAll(opened);

    const reopenedRepository = createExpoGoJournalRepository(
      nodeSqliteDependencies(databasePath, opened),
    );
    const reopenedA = service(reopenedRepository, "account-a");
    const reopenedB = service(reopenedRepository, "account-b");
    await expect(reopenedA.loadRecord(recordA.id)).resolves.toMatchObject({
      record: {
        body: "更新后的内容",
        cardSnapshot: {
          cardId: "private-card",
          sections: [{ id: "need", text: "用户明确保存的卡片快照" }],
        },
      },
      entries: [{ body: "更新后的补充" }],
    });
    await expect(opened[0]!.getFirstAsync<{ card_snapshot_json: string | null }>(
      "SELECT card_snapshot_json FROM journal_records WHERE id=?",
      recordA.id,
    )).resolves.toEqual({
      card_snapshot_json: JSON.stringify({
        cardId: "private-card",
        capturedAt: "2026-08-27T12:00:00.000Z",
        sections: [{ id: "need", text: "用户明确保存的卡片快照" }],
      }),
    });
    await expect(reopenedA.listPeriodReviews()).resolves.toMatchObject([
      { title: "八月回顾", body: "阶段回顾" },
    ]);
    await expect(reopenedB.loadRecord(recordA.id)).resolves.toBeNull();
    await expect(reopenedB.listRecords()).resolves.toMatchObject([{ title: "B 的手记" }]);
    await expect(reopenedB.listPeriodReviews()).resolves.toEqual([]);

    await reopenedA.clearCurrentAccount();
    await expect(reopenedA.listRecords()).resolves.toEqual([]);
    await expect(reopenedA.listPeriodReviews()).resolves.toEqual([]);
    await expect(reopenedA.ensureDeletionCleanup()).resolves.toBe(true);
    await expect(opened[0]!.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM journal_entries",
    )).resolves.toEqual({ count: 0 });
    await expect(reopenedB.listRecords()).resolves.toHaveLength(1);
    await reopenedA.createRecord({
      title: "A 删除后新建",
      occurredAt: "2026-08-29",
      highlight: { kind: "feeling", text: "重新开始" },
    });
    await expect(reopenedA.ensureDeletionCleanup()).resolves.toBe(false);

    await reopenedRepository.clearAll();
    await closeAll(opened);
    const afterClearRepository = createExpoGoJournalRepository(
      nodeSqliteDependencies(databasePath, opened),
    );
    await expect(service(afterClearRepository, "account-a").listRecords()).resolves.toEqual([]);
    await expect(service(afterClearRepository, "account-b").listRecords()).resolves.toEqual([]);
  } finally {
    await closeAll(opened);
    for (const suffix of ["", "-shm", "-wal"]) {
      rmSync(`${databasePath}${suffix}`, { force: true });
    }
  }
});

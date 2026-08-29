import { SqlLocalDataRepository } from "./local-data-repository";
import type {
  DatabaseConnection,
  TransactionalEncryptedDatabaseManager
} from "./database";

function connectionWithRows() {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const getAllAsync = jest.fn(async (...args: [string, ...unknown[]]): Promise<unknown[]> => {
    const [sql] = args;
    if (sql === "PRAGMA table_info(privacy_settings)") return [];
    if (sql.includes("course_progress")) return [{ lesson_id: "lesson-1", completed_at: "now", quiz_correct: 2, quiz_total: 3 }];
    return [{ id: "save-1", scenario_id: "scenario-1", created_at: "now", expression_card: '{"boundary":"停"}', transcript: null }];
  });
  const getFirstAsync = jest.fn(async (...args: [string, ...unknown[]]): Promise<unknown | null> => {
    void args;
    return null;
  });
  const connection: DatabaseConnection = {
    execAsync: jest.fn(async () => {}),
    runAsync: jest.fn(async (sql: string, ...params: unknown[]) => { calls.push({ sql, params }); return { changes: 1 }; }),
    getAllAsync: async <T,>(sql: string, ...params: unknown[]) => (
      await getAllAsync(sql, ...params) as T[]
    ),
    getFirstAsync: async <T,>(sql: string, ...params: unknown[]) => (
      await getFirstAsync(sql, ...params) as T | null
    ),
    closeAsync: jest.fn(async () => {})
  };
  const manager: TransactionalEncryptedDatabaseManager = {
    initialize: jest.fn(async () => connection),
    close: jest.fn(async () => undefined),
    removeDatabaseFiles: jest.fn(async () => undefined),
    withExclusiveMaintenance: jest.fn(),
    withTransaction: jest.fn(async (operation) => operation(connection))
  };
  return { calls, connection, getAllAsync, getFirstAsync, manager };
}

describe("SqlLocalDataRepository", () => {
  test("persists progress and saved cards using parameters, never user interpolation", async () => {
    const harness = connectionWithRows();
    const repository = new SqlLocalDataRepository(harness.manager);
    const malicious = "save-'); DROP TABLE saved_records; --";

    await repository.setCourseProgress({ lessonId: malicious, completedAt: "now", quizCorrect: 2, quizTotal: 3 });
    await repository.saveRecord({ id: malicious, scenarioId: "scenario-1", createdAt: "now", expressionCard: { boundary: "停" } });

    expect(harness.calls).toHaveLength(2);
    for (const call of harness.calls) {
      expect(call.sql).toContain("?");
      expect(call.sql).not.toContain(malicious);
      expect(call.params).toContain(malicious);
    }
    expect(harness.calls[1]?.params.at(-1)).toBeNull();
  });

  test("does not synthesize transcript history when a save omitted it", async () => {
    const harness = connectionWithRows();
    const repository = new SqlLocalDataRepository(harness.manager);
    const records = await repository.listSavedRecords();
    expect(records).toEqual([{ id: "save-1", scenarioId: "scenario-1", createdAt: "now", expressionCard: { boundary: "停" } }]);
    expect(records[0]).not.toHaveProperty("transcript");
  });

  test("supports per-record and idempotent all-data deletion", async () => {
    const harness = connectionWithRows();
    const repository = new SqlLocalDataRepository(harness.manager);
    await repository.deleteRecord("save-1");
    await repository.deleteAll();
    await repository.deleteAll();
    expect(harness.calls.some(({ sql, params }) => sql === "DELETE FROM saved_records WHERE id = ?" && params[0] === "save-1")).toBe(true);
    expect(harness.calls.filter(({ sql }) => sql.startsWith("DELETE FROM"))).toHaveLength(9);
  });

  test("returns secure privacy defaults when no row exists", async () => {
    const harness = connectionWithRows();
    const repository = new SqlLocalDataRepository(harness.manager);
    await expect(repository.getPrivacySettings()).resolves.toEqual({
      liveModelAcknowledged: false,
      defaultSaveTranscript: false,
      showLocalJournalSaveNotice: true,
    });
  });

  test("persists and resets the local journal save notice preference", async () => {
    const harness = connectionWithRows();
    const repository = new SqlLocalDataRepository(harness.manager);

    await repository.setPrivacySettings({
      liveModelAcknowledged: false,
      defaultSaveTranscript: false,
      showLocalJournalSaveNotice: false,
    });
    await repository.resetPrivacySettings();

    expect(harness.calls[0]?.sql).not.toContain("show_local_journal_save_notice");
    expect(harness.calls[1]?.sql).toContain("local_journal_preferences");
    expect(harness.calls[1]?.params.at(-1)).toBe(0);
    expect(harness.calls[2]).toEqual({ sql: "DELETE FROM privacy_settings", params: [] });
    expect(harness.calls[3]).toEqual({ sql: "DELETE FROM local_journal_preferences", params: [] });
    expect(harness.manager.withTransaction).toHaveBeenCalledTimes(2);
  });

  test("reads the legacy local v6 journal preference without altering its published table", async () => {
    const harness = connectionWithRows();
    harness.getAllAsync.mockImplementation(async (sql: string) => (
      sql === "PRAGMA table_info(privacy_settings)"
        ? [{ name: "show_local_journal_save_notice" }]
        : []
    ));
    harness.getFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes("show_local_journal_save_notice")) {
        return { show_local_journal_save_notice: 0 };
      }
      return null;
    });
    const repository = new SqlLocalDataRepository(harness.manager);

    await expect(repository.getPrivacySettings()).resolves.toEqual({
      liveModelAcknowledged: false,
      defaultSaveTranscript: false,
      showLocalJournalSaveNotice: false,
    });
    expect(harness.calls).toHaveLength(0);
  });
});

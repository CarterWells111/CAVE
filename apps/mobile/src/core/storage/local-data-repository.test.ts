import { SqlLocalDataRepository } from "./local-data-repository";
import type { DatabaseConnection, EncryptedDatabaseManager } from "./database";

function connectionWithRows() {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const connection = {
    execAsync: jest.fn(async () => {}),
    runAsync: jest.fn(async (sql: string, ...params: unknown[]) => { calls.push({ sql, params }); return { changes: 1 }; }),
    getAllAsync: jest.fn(async (sql: string) => {
      if (sql.includes("course_progress")) return [{ lesson_id: "lesson-1", completed_at: "now", quiz_correct: 2, quiz_total: 3 }];
      return [{ id: "save-1", scenario_id: "scenario-1", created_at: "now", expression_card: '{"boundary":"停"}', transcript: null }];
    }),
    getFirstAsync: jest.fn(async () => null),
    closeAsync: jest.fn(async () => {})
  };
  const manager: EncryptedDatabaseManager = {
    initialize: jest.fn(async () => connection as unknown as DatabaseConnection),
    close: jest.fn(async () => undefined),
    removeDatabaseFiles: jest.fn(async () => undefined),
    withExclusiveMaintenance: jest.fn()
  };
  return { calls, connection, manager };
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
    expect(harness.calls.filter(({ sql }) => sql.startsWith("DELETE FROM"))).toHaveLength(7);
  });

  test("returns secure privacy defaults when no row exists", async () => {
    const harness = connectionWithRows();
    const repository = new SqlLocalDataRepository(harness.manager);
    await expect(repository.getPrivacySettings()).resolves.toEqual({
      liveModelAcknowledged: false,
      defaultSaveTranscript: false
    });
  });
});

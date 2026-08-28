import type { DatabaseConnection, EncryptedDatabaseManager } from "../../../core/storage/database";
import { SqlReviewHistoryRepository } from "./sql-review-history-repository";

function harness() {
  const connection: DatabaseConnection = {
    execAsync: jest.fn(async () => undefined),
    runAsync: jest.fn(async () => ({ changes: 1 })),
    getAllAsync: jest.fn(async () => [{ id: "v1", root_id: "r1", parent_version_id: null, title: "回顾", review_date: "2026-08-27", status: "completed", created_at: "2026-08-27T12:00:00.000Z" }] as never[]),
    getFirstAsync: jest.fn(async () => ({ id: "v1" }) as never),
    closeAsync: jest.fn(async () => undefined),
  };
  const database: EncryptedDatabaseManager = { initialize: jest.fn(async () => connection), close: jest.fn(), removeDatabaseFiles: jest.fn() };
  return { connection, repository: new SqlReviewHistoryRepository<{ sourceRevision: number }>(database) };
}

test("lists neutral review metadata without selecting payload", async () => {
  const { connection, repository } = harness();
  await expect(repository.listMetadata()).resolves.toEqual([expect.objectContaining({ id: "v1", title: "回顾", status: "completed" })]);
  const sql = (connection.getAllAsync as jest.Mock).mock.calls[0]?.[0] as string;
  expect(sql).not.toMatch(/payload/iu);
});

test("rolls back a failed transactional version deletion", async () => {
  const { connection, repository } = harness();
  (connection.runAsync as jest.Mock).mockRejectedValueOnce(new Error("disk failure"));
  await expect(repository.deleteVersion("v1")).rejects.toThrow("disk failure");
  expect(connection.execAsync).toHaveBeenNthCalledWith(1, "BEGIN IMMEDIATE");
  expect(connection.execAsync).toHaveBeenLastCalledWith("ROLLBACK");
});

test("detaches both child versions and the active branch before deleting its base", async () => {
  const { connection, repository } = harness();
  await expect(repository.deleteVersion("v1")).resolves.toBe(true);
  expect(connection.runAsync).toHaveBeenCalledWith(
    "UPDATE journey_active_review SET base_version_id = NULL WHERE base_version_id = ?", "v1",
  );
  expect(connection.execAsync).toHaveBeenLastCalledWith("COMMIT");
});

test("rolls back the version and active transition together", async () => {
  const { connection, repository } = harness();
  (connection.runAsync as jest.Mock)
    .mockResolvedValueOnce({ changes: 1 })
    .mockRejectedValueOnce(new Error("active clear failed"));
  await expect(repository.appendVersionAndClearActive({
    id: "v2", rootId: "r1", parentVersionId: "v1", title: "新回顾",
    createdAt: "2026-08-27T13:00:00.000Z", status: "completed", payload: { sourceRevision: 2 },
  })).rejects.toThrow("active clear failed");
  expect(connection.execAsync).toHaveBeenNthCalledWith(1, "BEGIN IMMEDIATE");
  expect(connection.execAsync).toHaveBeenLastCalledWith("ROLLBACK");
});

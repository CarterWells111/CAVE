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

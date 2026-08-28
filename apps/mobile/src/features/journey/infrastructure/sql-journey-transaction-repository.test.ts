import type {
  DatabaseConnection,
  TransactionalEncryptedDatabaseManager
} from "../../../core/storage/database";
import { createJourneyDraft } from "../domain/types";
import { SqlJourneyTransactionRepository } from "./sql-journey-transaction-repository";

function harness(failRun?: number) {
  let run = 0;
  const connection: DatabaseConnection = {
    execAsync: jest.fn(async () => undefined),
    runAsync: jest.fn(async () => {
      run += 1;
      if (run === failRun) throw new Error(`write-${run}-failed`);
      return { changes: 1 };
    }),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async () => null),
    closeAsync: jest.fn(async () => undefined),
  };
  const database: TransactionalEncryptedDatabaseManager = {
    initialize: jest.fn(async () => connection),
    withTransaction: jest.fn(async (operation) => {
      await connection.execAsync("BEGIN IMMEDIATE");
      try {
        const result = await operation(connection);
        await connection.execAsync("COMMIT");
        return result;
      } catch (error) {
        await connection.execAsync("ROLLBACK");
        throw error;
      }
    }),
    close: jest.fn(async () => undefined),
    removeDatabaseFiles: jest.fn(async () => undefined),
    withExclusiveMaintenance: jest.fn()
  };
  return { connection, database, repository: new SqlJourneyTransactionRepository(database) };
}

const draft = { ...createJourneyDraft({ id: "branch-1", now: "2026-08-27T12:00:00.000Z" }), ageConfirmed: true };

test("delegates transaction ownership to the database manager", async () => {
  const { database, repository } = harness();

  await repository.saveActive(draft, {
    id: "active:branch-1", rootId: "root-1", sourceVersionId: "version-1",
    title: "分支", updatedAt: draft.updatedAt, payload: draft,
  });

  expect(database.withTransaction).toHaveBeenCalledTimes(1);
  expect(database.initialize).not.toHaveBeenCalled();
});

test.each([1, 2])("rolls back branch activation when statement %s fails", async (failRun) => {
  const { connection, repository } = harness(failRun);
  await expect(repository.saveActive(draft, {
    id: "active:branch-1", rootId: "root-1", sourceVersionId: "version-1",
    title: "分支", updatedAt: draft.updatedAt, payload: draft,
  })).rejects.toThrow(`write-${failRun}-failed`);
  expect(connection.execAsync).toHaveBeenNthCalledWith(1, "BEGIN IMMEDIATE");
  expect(connection.execAsync).toHaveBeenLastCalledWith("ROLLBACK");
});

test("persists branch payload and exact lineage in one transaction", async () => {
  const { connection, repository } = harness();
  await repository.saveActive(draft, {
    id: "active:branch-1", rootId: "root-1", sourceVersionId: "version-1",
    title: "分支", updatedAt: draft.updatedAt, payload: draft,
  });
  expect(connection.runAsync).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining("journey_active_review"),
    "root-1", "version-1", JSON.stringify(draft), draft.updatedAt, draft.updatedAt,
  );
  expect(connection.runAsync).toHaveBeenNthCalledWith(
    1,
    expect.stringContaining("journey_drafts_v4"),
    draft.id,
    4,
    JSON.stringify(draft),
    draft.createdAt,
    draft.updatedAt,
  );
  expect(connection.execAsync).toHaveBeenLastCalledWith("COMMIT");
});

test.each([1, 2, 3, 4, 5, 6, 7])("rolls back active replacement and branch creation when statement %s fails", async (failRun) => {
  const { connection, repository } = harness(failRun);
  await expect(repository.branch({
    archivedActive: {
      id: "review:old:incomplete", rootId: "old-root", parentVersionId: null,
      title: "旧草稿", createdAt: draft.updatedAt, status: "incomplete", payload: draft,
    },
    branch: { ...draft, id: "new-branch" },
    active: {
      id: "active:new-branch", rootId: "root-1", sourceVersionId: "version-1",
      title: "新分支", updatedAt: draft.updatedAt, payload: { ...draft, id: "new-branch" },
    },
  })).rejects.toThrow(`write-${failRun}-failed`);
  expect(connection.execAsync).toHaveBeenLastCalledWith("ROLLBACK");
});

test.each([1, 2, 3, 4, 5, 6, 7, 8])("rolls back completion when statement %s fails", async (failRun) => {
  const { connection, repository } = harness(failRun);
  await expect(repository.complete({
    draft,
    card: { id: "card:branch-1", journeyId: draft.id, card: draft.communicationCard, savedAt: draft.updatedAt },
    version: { id: "review:branch-1:completed", rootId: "root-1", parentVersionId: "version-1", title: "回顾", createdAt: draft.updatedAt, status: "completed", payload: draft },
    shell: { initialJourneyId: draft.id, initialJourneyCompletedAt: draft.updatedAt },
  })).rejects.toThrow(`write-${failRun}-failed`);
  expect(connection.execAsync).toHaveBeenNthCalledWith(1, "BEGIN IMMEDIATE");
  expect(connection.execAsync).toHaveBeenLastCalledWith("ROLLBACK");
});

test("commits card version marker and active cleanup as one completion", async () => {
  const { connection, repository } = harness();
  await repository.complete({
    draft,
    card: { id: "card:branch-1", journeyId: draft.id, card: draft.communicationCard, savedAt: draft.updatedAt },
    version: { id: "review:branch-1:completed", rootId: "root-1", parentVersionId: "version-1", title: "回顾", createdAt: draft.updatedAt, status: "completed", payload: draft },
    shell: { initialJourneyId: draft.id, initialJourneyCompletedAt: draft.updatedAt },
  });
  expect(connection.runAsync).toHaveBeenCalledTimes(8);
  expect(connection.runAsync).toHaveBeenCalledWith("DELETE FROM journey_drafts_v4");
  expect(connection.runAsync).toHaveBeenCalledWith("DELETE FROM journey_drafts_v3");
  expect(connection.runAsync).toHaveBeenCalledWith("DELETE FROM journey_drafts_v2");
  expect(connection.execAsync).toHaveBeenLastCalledWith("COMMIT");
});

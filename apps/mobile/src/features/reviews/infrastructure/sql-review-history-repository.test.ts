import type {
  DatabaseConnection,
  TransactionalEncryptedDatabaseManager
} from "../../../core/storage/database";
import type { JourneyDraftV2 } from "../../journey/domain/migrate-journey-draft";
import { createJourneyDraft, type JourneyDraft } from "../../journey/domain/types";
import { JourneyStorageError } from "../../journey/infrastructure/journey-draft-repository";
import {
  journeyDraftReviewPayloadCodec,
  SqlReviewHistoryRepository
} from "./sql-review-history-repository";

function harness() {
  const connection: DatabaseConnection = {
    execAsync: jest.fn(async () => undefined),
    runAsync: jest.fn(async () => ({ changes: 1 })),
    getAllAsync: jest.fn(async () => [{ id: "v1", root_id: "r1", parent_version_id: null, title: "回顾", review_date: "2026-08-27", status: "completed", created_at: "2026-08-27T12:00:00.000Z" }] as never[]),
    getFirstAsync: jest.fn(async () => ({ id: "v1" }) as never),
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
    close: jest.fn(),
    removeDatabaseFiles: jest.fn(),
    withExclusiveMaintenance: jest.fn()
  };
  return {
    connection,
    database,
    repository: new SqlReviewHistoryRepository<{ sourceRevision: number }>(database, {
      decode(value) { return value as { sourceRevision: number }; }
    })
  };
}

function oldJourneyDraft(): JourneyDraftV2 {
  const current = createJourneyDraft({ id: "old-review", now: "created" });
  return {
    ...current,
    schemaVersion: 2,
    currentPage: "behavior-map",
    cloudSaveAvailability: "coming-soon",
    overnightCustomNote: "private overnight note",
    journal: { text: "private journal text", saveChoice: "device" },
    communicationCard: {
      ...current.communicationCard,
      "communication-not-this-time": {
        generatedText: "generated",
        userText: "private review boundary",
        sourceRevision: 5,
        needsReview: true,
        visibility: "private"
      }
    },
    pointEventKeys: []
  };
}

function interimBodyKnowledgeReview(): JourneyDraftV2 {
  return {
    ...createJourneyDraft({ id: "interim-review", now: "created" }),
    schemaVersion: 2,
    currentPage: "body-knowledge",
    pointEventKeys: []
  };
}

function journeyRepositoryWith(row: Record<string, unknown>) {
  const connection: DatabaseConnection = {
    execAsync: jest.fn(async () => undefined),
    runAsync: jest.fn(async () => ({ changes: 1 })),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async () => row as never),
    closeAsync: jest.fn(async () => undefined),
  };
  const database: TransactionalEncryptedDatabaseManager = {
    initialize: jest.fn(async () => connection),
    withTransaction: jest.fn(async (operation) => operation(connection)),
    close: jest.fn(async () => undefined),
    removeDatabaseFiles: jest.fn(async () => undefined),
    withExclusiveMaintenance: jest.fn()
  };
  return new SqlReviewHistoryRepository<JourneyDraft>(database, journeyDraftReviewPayloadCodec);
}

test("lists neutral review metadata without selecting payload", async () => {
  const { connection, repository } = harness();
  await expect(repository.listMetadata()).resolves.toEqual([expect.objectContaining({ id: "v1", title: "回顾", status: "completed" })]);
  const sql = (connection.getAllAsync as jest.Mock).mock.calls[0]?.[0] as string;
  expect(sql).not.toMatch(/payload/iu);
});

test("delegates multi-table review writes to the database transaction manager", async () => {
  const { database, repository } = harness();

  await repository.clearAll();

  expect(database.withTransaction).toHaveBeenCalledTimes(1);
  expect(database.initialize).not.toHaveBeenCalled();
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

test("loads an old v2 active review as v3 without dropping private fields", async () => {
  const repository = journeyRepositoryWith({
    root_id: "root-1",
    base_version_id: "version-1",
    payload: JSON.stringify(oldJourneyDraft()),
    created_at: "created",
    updated_at: "updated"
  });

  await expect(repository.loadActive()).resolves.toMatchObject({
    rootId: "root-1",
    sourceVersionId: "version-1",
    payload: {
      schemaVersion: 3,
      currentPage: "behavior-map",
      overnightCustomNote: "private overnight note",
      journal: { text: "private journal text" },
      pointEventKeys: expect.arrayContaining(["progress:overnight-complete:v1"]),
      communicationCard: {
        "communication-not-this-time": expect.objectContaining({ userText: "private review boundary" })
      }
    }
  });
});

test("loads an interim v2 body-knowledge review without skipping overnight", async () => {
  const repository = journeyRepositoryWith({
    root_id: "root-1",
    base_version_id: "version-1",
    payload: JSON.stringify(interimBodyKnowledgeReview()),
    created_at: "created",
    updated_at: "updated"
  });

  await expect(repository.loadActive()).resolves.toMatchObject({
    payload: {
      schemaVersion: 3,
      currentPage: "body-knowledge",
      pointEventKeys: []
    }
  });
});

test("loads and branches an old v2 historical version as a current v3 payload", async () => {
  const row = {
    id: "version-1",
    root_id: "root-1",
    parent_version_id: null,
    title: "Old private review",
    review_date: "2026-08-27",
    status: "completed",
    payload: JSON.stringify(oldJourneyDraft()),
    source_revision: 5,
    created_at: "created"
  };
  const repository = journeyRepositoryWith(row);

  await expect(repository.loadDetail("version-1")).resolves.toMatchObject({
    payload: {
      schemaVersion: 3,
      journal: { text: "private journal text" },
      communicationCard: {
        "communication-not-this-time": expect.objectContaining({ userText: "private review boundary" })
      }
    }
  });
  await expect(repository.loadBranchSeed("version-1")).resolves.toMatchObject({
    sourceVersionId: "version-1",
    payload: {
      schemaVersion: 3,
      currentPage: "behavior-map",
      pointEventKeys: expect.arrayContaining(["progress:overnight-complete:v1"])
    }
  });
});

test("does not accept an unknown journey schema from review storage", async () => {
  const repository = journeyRepositoryWith({
    root_id: "root-1",
    base_version_id: null,
    payload: JSON.stringify({ schemaVersion: 99 }),
    created_at: "created",
    updated_at: "updated"
  });

  await expect(repository.loadActive()).rejects.toEqual(new JourneyStorageError("unsupported-schema"));
});

test.each([
  ["active review", (repository: SqlReviewHistoryRepository<JourneyDraft>) => repository.loadActive()],
  ["historical detail", (repository: SqlReviewHistoryRepository<JourneyDraft>) => repository.loadDetail("version-1")],
  ["branch seed", (repository: SqlReviewHistoryRepository<JourneyDraft>) => repository.loadBranchSeed("version-1")]
])("rejects a JourneyDraft without schemaVersion at the %s boundary", async (_label, load) => {
  const repository = journeyRepositoryWith({
    id: "version-1",
    root_id: "root-1",
    base_version_id: null,
    parent_version_id: null,
    title: "Damaged review",
    review_date: "2026-08-27",
    status: "completed",
    payload: JSON.stringify({ id: "damaged-review", currentPage: "reflection" }),
    source_revision: 1,
    created_at: "created",
    updated_at: "updated"
  });

  await expect(load(repository)).rejects.toEqual(new JourneyStorageError("malformed-payload"));
});

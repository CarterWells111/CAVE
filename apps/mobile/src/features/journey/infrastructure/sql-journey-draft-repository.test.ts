import type { DatabaseConnection, EncryptedDatabaseManager } from "../../../core/storage/database";
import { createJourneyDraft, type SavedCommunicationCardRecord } from "../domain/types";
import { JourneyStorageError } from "./journey-draft-repository";
import { SqlCommunicationCardRepository, SqlJourneyDraftRepository } from "./sql-journey-draft-repository";

function harness() {
  let draftRow: Record<string, unknown> | null = null;
  const cards = new Map<string, Record<string, unknown>>();
  const connection: DatabaseConnection = {
    execAsync: jest.fn(async () => undefined),
    runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.startsWith("INSERT INTO journey_drafts")) {
        draftRow = { id: params[0], schema_version: params[1], payload: params[2] };
      } else if (sql === "DELETE FROM journey_drafts") {
        draftRow = null;
      } else if (sql.startsWith("INSERT INTO journey_cards")) {
        cards.set(String(params[0]), {
          id: params[0], journey_id: params[1], payload: params[2], saved_at: params[3]
        });
      } else if (sql === "DELETE FROM journey_cards WHERE id = ?") {
        cards.delete(String(params[0]));
      }
      return { changes: 1 };
    }),
    getAllAsync: jest.fn(async () => [...cards.values()] as never[]),
    getFirstAsync: jest.fn(async () => draftRow as never),
    closeAsync: jest.fn(async () => undefined)
  };
  const manager: EncryptedDatabaseManager = {
    initialize: jest.fn(async () => connection),
    close: jest.fn(async () => undefined),
    removeDatabaseFiles: jest.fn(async () => undefined)
  };
  return { connection, manager, setDraftRow: (row: Record<string, unknown> | null) => { draftRow = row; } };
}

describe("SqlJourneyDraftRepository", () => {
  test("loads empty storage, then upserts and deletes an active v1 draft", async () => {
    const fake = harness();
    const repository = new SqlJourneyDraftRepository(fake.manager);
    const draft = { ...createJourneyDraft({ id: "journey-1", now: "now" }), ageConfirmed: true };

    await expect(repository.loadActive()).resolves.toBeNull();
    await repository.saveActive(draft);
    await expect(repository.loadActive()).resolves.toEqual(draft);
    await repository.deleteActive();
    await expect(repository.loadActive()).resolves.toBeNull();
  });

  test("rejects unknown schemas and malformed v1 payloads with typed errors", async () => {
    const fake = harness();
    const repository = new SqlJourneyDraftRepository(fake.manager);
    fake.setDraftRow({ id: "journey-1", schema_version: 2, payload: "{}" });
    await expect(repository.loadActive()).rejects.toEqual(new JourneyStorageError("unsupported-schema"));

    fake.setDraftRow({ id: "journey-1", schema_version: 1, payload: "not-json" });
    await expect(repository.loadActive()).rejects.toEqual(new JourneyStorageError("malformed-payload"));

    fake.setDraftRow({ id: "journey-1", schema_version: 1, payload: "{}" });
    await expect(repository.loadActive()).rejects.toEqual(new JourneyStorageError("malformed-payload"));
  });
});

describe("SqlCommunicationCardRepository", () => {
  test("lists, upserts and deletes cards through the same encrypted connection", async () => {
    const fake = harness();
    const repository = new SqlCommunicationCardRepository(fake.manager);
    const record: SavedCommunicationCardRecord = {
      id: "card-1",
      journeyId: "journey-1",
      card: { intentions: { generatedText: "draft-card.intentions", sourceRevision: 1, needsReview: false } },
      savedAt: "now"
    };

    await repository.save(record);
    await expect(repository.list()).resolves.toEqual([record]);
    await repository.delete("card-1");
    await expect(repository.list()).resolves.toEqual([]);
  });
});

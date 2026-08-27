import type { DatabaseConnection, EncryptedDatabaseManager } from "../../../core/storage/database";
import type { JourneyDraftV1 } from "../domain/migrate-journey-draft";
import { createJourneyDraft, type SavedCommunicationCardRecord } from "../domain/types";
import { JourneyStorageError } from "./journey-draft-repository";
import { SqlCommunicationCardRepository, SqlJourneyDraftRepository } from "./sql-journey-draft-repository";

function harness(options: { failLegacyDeleteOnce?: boolean; failV2InsertOnce?: boolean } = {}) {
  let draftRow: Record<string, unknown> | null = null;
  let legacyDraftRow: Record<string, unknown> | null = null;
  let transactionSnapshot: {
    draftRow: Record<string, unknown> | null;
    legacyDraftRow: Record<string, unknown> | null;
    receiptSourceIds: Set<string>;
  } | null = null;
  let failLegacyDeleteOnce = options.failLegacyDeleteOnce ?? false;
  let failV2InsertOnce = options.failV2InsertOnce ?? false;
  const receiptSourceIds = new Set<string>();
  const cards = new Map<string, Record<string, unknown>>();
  const sqlCalls: string[] = [];
  const connection: DatabaseConnection = {
    execAsync: jest.fn(async (sql: string) => {
      sqlCalls.push(sql);
      if (sql === "BEGIN IMMEDIATE") {
        transactionSnapshot = {
          draftRow,
          legacyDraftRow,
          receiptSourceIds: new Set(receiptSourceIds),
        };
      } else if (sql === "COMMIT") {
        transactionSnapshot = null;
      } else if (sql === "ROLLBACK" && transactionSnapshot !== null) {
        draftRow = transactionSnapshot.draftRow;
        legacyDraftRow = transactionSnapshot.legacyDraftRow;
        receiptSourceIds.clear();
        for (const id of transactionSnapshot.receiptSourceIds) receiptSourceIds.add(id);
        transactionSnapshot = null;
      }
    }),
    runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      sqlCalls.push(sql);
      if (sql.startsWith("INSERT INTO journey_drafts_v2")) {
        if (failV2InsertOnce) {
          failV2InsertOnce = false;
          throw new Error("disk write failed");
        }
        draftRow = { id: params[0], schema_version: params[1], payload: params[2] };
      } else if (sql === "DELETE FROM journey_drafts_v2") {
        draftRow = null;
      } else if (sql === "DELETE FROM journey_drafts") {
        if (failLegacyDeleteOnce) {
          failLegacyDeleteOnce = false;
          throw new Error("legacy delete failed");
        }
        legacyDraftRow = null;
      } else if (sql.startsWith("INSERT INTO journey_migration_receipts")) {
        receiptSourceIds.add(String(params[1]));
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
    getFirstAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      sqlCalls.push(sql);
      if (sql.includes("FROM journey_cards")) {
        return (cards.get(String(params[0])) ?? null) as never;
      }
      if (sql.includes("journey_migration_receipts")) {
        return (receiptSourceIds.has(String(params[0])) ? { migration_id: `receipt:${String(params[0])}` } : null) as never;
      }
      return (sql.includes("journey_drafts_v2") ? draftRow : legacyDraftRow) as never;
    }),
    closeAsync: jest.fn(async () => undefined)
  };
  const manager: EncryptedDatabaseManager = {
    initialize: jest.fn(async () => connection),
    close: jest.fn(async () => undefined),
    removeDatabaseFiles: jest.fn(async () => undefined)
  };
  return {
    connection,
    manager,
    sqlCalls,
    setDraftRow: (row: Record<string, unknown> | null) => { draftRow = row; },
    setLegacyDraftRow: (row: Record<string, unknown> | null) => { legacyDraftRow = row; }
  };
}

function legacyDraft(): JourneyDraftV1 {
  return {
    id: "legacy-journey",
    schemaVersion: 1,
    currentPage: "communication-card",
    ageConfirmed: true,
    prefaceRead: true,
    expectationIds: ["rest"],
    concernIds: ["pressure"],
    overnightCustomNote: "",
    readKnowledgeCardIds: ["body-response"],
    medicalDiagramOpened: false,
    behaviorAttitudes: { kissing: "unsure" },
    customBehaviors: [],
    motivationIds: ["curious"],
    comfortNeedIds: ["ask-first"],
    expressionSupportNeeded: true,
    journalSaveChoice: "device",
    cloudSaveAvailability: "coming-soon",
    practice: { completed: false },
    checklistItems: [],
    communicationCard: {
      boundaries: {
        generatedText: "old",
        userText: "Please ask.",
        sourceRevision: 1,
        needsReview: false
      }
    },
    pointEventKeys: [],
    sourceRevision: 1,
    createdAt: "created",
    updatedAt: "updated"
  };
}

describe("SqlJourneyDraftRepository", () => {
  test("loads empty storage, then upserts and deletes an active v2 draft", async () => {
    const fake = harness();
    const repository = new SqlJourneyDraftRepository(fake.manager);
    const draft = { ...createJourneyDraft({ id: "journey-1", now: "now" }), ageConfirmed: true };

    await expect(repository.loadActive()).resolves.toBeNull();
    await repository.saveActive(draft);
    await expect(repository.loadActive()).resolves.toEqual(draft);
    await repository.deleteActive();
    await expect(repository.loadActive()).resolves.toBeNull();
    expect(fake.sqlCalls.join("\n")).toContain("journey_drafts_v2");
    expect(fake.sqlCalls.join("\n")).not.toContain("INSERT INTO journey_drafts (");
  });

  test("transactionally migrates one legacy v1 draft and records an idempotent receipt", async () => {
    const fake = harness();
    const legacy = legacyDraft();
    fake.setLegacyDraftRow({ schema_version: 1, payload: JSON.stringify(legacy) });
    const repository = new SqlJourneyDraftRepository(fake.manager);

    const migrated = await repository.loadActive();
    expect(migrated).toMatchObject({
      id: legacy.id,
      schemaVersion: 2,
      currentPage: "final-preparation",
      addressPreference: null
    });
    expect(migrated?.communicationCard["communication-not-this-time"]).toMatchObject({
      userText: "Please ask.",
      visibility: "private",
      needsReview: true
    });
    expect(fake.sqlCalls).toContain("BEGIN IMMEDIATE");
    expect(fake.sqlCalls.indexOf("BEGIN IMMEDIATE")).toBeLessThan(
      fake.sqlCalls.findIndex((sql) => sql.includes("FROM journey_drafts ORDER BY"))
    );
    expect(fake.sqlCalls.some((sql) => sql.startsWith("INSERT INTO journey_migration_receipts"))).toBe(true);
    expect(fake.sqlCalls).toContain("COMMIT");

    const receiptCount = fake.sqlCalls.filter((sql) => sql.startsWith("INSERT INTO journey_migration_receipts")).length;
    await expect(repository.loadActive()).resolves.toEqual(migrated);
    expect(fake.sqlCalls.filter((sql) => sql.startsWith("INSERT INTO journey_migration_receipts"))).toHaveLength(receiptCount);
  });

  test("does not repeat a legacy migration when its receipt exists but the v2 row is absent", async () => {
    const fake = harness();
    const legacy = legacyDraft();
    fake.setLegacyDraftRow({ schema_version: 1, payload: JSON.stringify(legacy) });
    const repository = new SqlJourneyDraftRepository(fake.manager);

    await expect(repository.loadActive()).resolves.toMatchObject({ id: legacy.id, schemaVersion: 2 });
    fake.setDraftRow(null);

    await expect(repository.loadActive()).resolves.toBeNull();
    expect(fake.sqlCalls.some((sql) => sql.includes("FROM journey_migration_receipts"))).toBe(true);
  });

  test("migrate then reset cannot revive the legacy draft on a cold load", async () => {
    const fake = harness();
    fake.setLegacyDraftRow({ schema_version: 1, payload: JSON.stringify(legacyDraft()) });

    await expect(new SqlJourneyDraftRepository(fake.manager).loadActive()).resolves.toMatchObject({ schemaVersion: 2 });
    await new SqlJourneyDraftRepository(fake.manager).deleteActive();

    await expect(new SqlJourneyDraftRepository(fake.manager).loadActive()).resolves.toBeNull();
    expect(fake.sqlCalls).toContain("DELETE FROM journey_drafts");
  });

  test("rolls back reset when deleting the legacy row fails", async () => {
    const fake = harness({ failLegacyDeleteOnce: true });
    const legacy = legacyDraft();
    fake.setLegacyDraftRow({ schema_version: 1, payload: JSON.stringify(legacy) });
    const repository = new SqlJourneyDraftRepository(fake.manager);
    const migrated = await repository.loadActive();

    await expect(repository.deleteActive()).rejects.toThrow("legacy delete failed");
    await expect(repository.loadActive()).resolves.toEqual(migrated);
    expect(fake.sqlCalls).toContain("ROLLBACK");
  });

  test("does not log legacy sensitive payloads during migration or reset", async () => {
    const fake = harness();
    fake.setLegacyDraftRow({ schema_version: 1, payload: JSON.stringify(legacyDraft()) });
    const repository = new SqlJourneyDraftRepository(fake.manager);
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      await repository.loadActive();
      await repository.deleteActive();
      expect(log).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      warn.mockRestore();
      error.mockRestore();
    }
  });

  test("rolls back a failed legacy migration and can retry without losing the v1 payload", async () => {
    const fake = harness({ failV2InsertOnce: true });
    const legacy = legacyDraft();
    fake.setLegacyDraftRow({ schema_version: 1, payload: JSON.stringify(legacy) });
    const repository = new SqlJourneyDraftRepository(fake.manager);

    await expect(repository.loadActive()).rejects.toThrow("disk write failed");
    expect(fake.sqlCalls).toContain("ROLLBACK");
    await expect(repository.loadActive()).resolves.toMatchObject({ id: legacy.id, schemaVersion: 2 });
  });

  test("rejects unknown schemas and malformed v2 payloads with typed errors", async () => {
    const fake = harness();
    const repository = new SqlJourneyDraftRepository(fake.manager);
    fake.setDraftRow({ id: "journey-1", schema_version: 3, payload: "{}" });
    await expect(repository.loadActive()).rejects.toEqual(new JourneyStorageError("unsupported-schema"));

    fake.setDraftRow({ id: "journey-1", schema_version: 2, payload: "not-json" });
    await expect(repository.loadActive()).rejects.toEqual(new JourneyStorageError("malformed-payload"));

    fake.setDraftRow({ id: "journey-1", schema_version: 2, payload: "{}" });
    await expect(repository.loadActive()).rejects.toEqual(new JourneyStorageError("malformed-payload"));
  });

  test.each([
    ["unknown page", { currentPage: "page-nine" }],
    ["invalid attitude", { behaviorAttitudes: { "draft-kissing": "maybe" } }],
    ["malformed custom behavior", { customBehaviors: [{ id: "custom-1" }] }],
    ["invalid checklist status", {
      privatePreparation: {
        items: [{ id: "checklist:logistics", category: "logistics", sourceIds: [], status: "later" }],
        excludedGroupIds: [],
        aftercareIds: []
      }
    }],
    ["invalid optional practice state", { practice: { completed: false, mirrorRehearsed: false, responseId: 42 } }],
    ["malformed communication field", {
      communicationCard: { intentions: { generatedText: "text", sourceRevision: 0 } }
    }],
    ["non-integer revision", { sourceRevision: 0.5 }]
  ])("rejects a persisted draft with %s", async (_label, patch) => {
    const fake = harness();
    const repository = new SqlJourneyDraftRepository(fake.manager);
    const malformed = { ...createJourneyDraft({ id: "journey-1", now: "now" }), ...patch };
    fake.setDraftRow({ id: "journey-1", schema_version: 2, payload: JSON.stringify(malformed) });

    await expect(repository.loadActive()).rejects.toEqual(new JourneyStorageError("malformed-payload"));
  });
});

describe("SqlCommunicationCardRepository", () => {
  test("migrates legacy saved cards into the private seven-section shape", async () => {
    const fake = harness();
    await fake.connection.runAsync(
      "INSERT INTO journey_cards (id, journey_id, payload, saved_at) VALUES (?, ?, ?, ?)",
      "legacy-card",
      "legacy-journey",
      JSON.stringify({
        boundaries: {
          generatedText: "old boundary",
          userText: "Please ask first.",
          sourceRevision: 2,
          needsReview: false
        }
      }),
      "now"
    );

    const [record] = await new SqlCommunicationCardRepository(fake.manager).list();
    if (record === undefined) throw new Error("expected migrated card");

    expect(Object.keys(record.card)).toHaveLength(7);
    expect(record.card["communication-not-this-time"]).toMatchObject({
      userText: "Please ask first.",
      needsReview: true,
      visibility: "private"
    });
  });

  test("lists, upserts and deletes cards through the same encrypted connection", async () => {
    const fake = harness();
    const repository = new SqlCommunicationCardRepository(fake.manager);
    const card = createJourneyDraft({ id: "card-draft", now: "now" }).communicationCard;
    card["communication-night-expectations"] = {
      generatedText: "draft-card.night-expectations",
      sourceRevision: 1,
      needsReview: false,
      visibility: "included"
    };
    const record: SavedCommunicationCardRecord = {
      id: "card-1",
      journeyId: "journey-1",
      card,
      savedAt: "now"
    };

    await repository.save(record);
    await expect(repository.list()).resolves.toEqual([record]);
    await repository.delete("card-1");
    await expect(repository.list()).resolves.toEqual([]);
  });

  test("lists card metadata without selecting or returning payload", async () => {
    const fake = harness();
    const repository = new SqlCommunicationCardRepository(fake.manager);
    await repository.save({
      id: "card-private",
      journeyId: "journey-private",
      card: createJourneyDraft({ id: "private", now: "now" }).communicationCard,
      savedAt: "2026-08-27T12:00:00.000Z",
    });

    await expect(repository.listMetadata()).resolves.toEqual([{
      id: "card-private",
      journeyId: "journey-private",
      savedAt: "2026-08-27T12:00:00.000Z",
    }]);

    const getAll = fake.connection.getAllAsync as jest.Mock;
    const metadataSql = getAll.mock.calls.at(-1)?.[0] as string;
    expect(metadataSql).toBe(
      "SELECT id, journey_id, saved_at FROM journey_cards ORDER BY saved_at DESC",
    );
    expect(metadataSql).not.toMatch(/payload/iu);

    await expect(repository.load("card-private")).resolves.toMatchObject({
      id: "card-private",
      journeyId: "journey-private",
    });
    const getFirst = fake.connection.getFirstAsync as jest.Mock;
    expect(getFirst.mock.calls.at(-1)?.[0]).toBe(
      "SELECT id, journey_id, payload, saved_at FROM journey_cards WHERE id = ?",
    );
  });
});

import type { EncryptedDatabaseManager } from "../../../core/storage/database";
import type { JourneyDraft, SavedCommunicationCardRecord } from "../domain/types";
import {
  JourneyStorageError,
  type CommunicationCardRepository,
  type JourneyDraftRepository
} from "./journey-draft-repository";

type DraftRow = { schema_version: number; payload: string };
type CardRow = { id: string; journey_id: string; payload: string; saved_at: string };

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJourneyDraft(value: unknown): value is JourneyDraft {
  if (!isRecord(value)) return false;
  const practice = value.practice;
  return value.schemaVersion === 1
    && typeof value.id === "string"
    && typeof value.currentPage === "string"
    && typeof value.ageConfirmed === "boolean"
    && typeof value.prefaceRead === "boolean"
    && isStringArray(value.expectationIds)
    && isStringArray(value.concernIds)
    && typeof value.overnightCustomNote === "string"
    && isStringArray(value.readKnowledgeCardIds)
    && typeof value.medicalDiagramOpened === "boolean"
    && isRecord(value.behaviorAttitudes)
    && Array.isArray(value.customBehaviors)
    && isStringArray(value.motivationIds)
    && isStringArray(value.comfortNeedIds)
    && (typeof value.expressionSupportNeeded === "boolean" || value.expressionSupportNeeded === null)
    && (value.journalSaveChoice === "device" || value.journalSaveChoice === "not-saved")
    && value.cloudSaveAvailability === "coming-soon"
    && isRecord(practice)
    && typeof practice.completed === "boolean"
    && Array.isArray(value.checklistItems)
    && isRecord(value.communicationCard)
    && isStringArray(value.pointEventKeys)
    && typeof value.sourceRevision === "number"
    && typeof value.createdAt === "string"
    && typeof value.updatedAt === "string";
}

function parseJson(payload: string): unknown {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    throw new JourneyStorageError("malformed-payload");
  }
}

export class SqlJourneyDraftRepository implements JourneyDraftRepository {
  constructor(private readonly database: EncryptedDatabaseManager) {}

  async loadActive(): Promise<JourneyDraft | null> {
    const connection = await this.database.initialize();
    const row = await connection.getFirstAsync<DraftRow>(
      "SELECT schema_version, payload FROM journey_drafts ORDER BY updated_at DESC LIMIT 1"
    );
    if (row === null) return null;
    if (row.schema_version !== 1) throw new JourneyStorageError("unsupported-schema");
    const value = parseJson(row.payload);
    if (!isJourneyDraft(value)) throw new JourneyStorageError("malformed-payload");
    return value;
  }

  async saveActive(draft: JourneyDraft): Promise<void> {
    const connection = await this.database.initialize();
    await connection.runAsync(
      "INSERT INTO journey_drafts (id, schema_version, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET schema_version = excluded.schema_version, payload = excluded.payload, created_at = excluded.created_at, updated_at = excluded.updated_at",
      draft.id,
      draft.schemaVersion,
      JSON.stringify(draft),
      draft.createdAt,
      draft.updatedAt
    );
  }

  async deleteActive(): Promise<void> {
    const connection = await this.database.initialize();
    await connection.runAsync("DELETE FROM journey_drafts");
  }
}

export class SqlCommunicationCardRepository implements CommunicationCardRepository {
  constructor(private readonly database: EncryptedDatabaseManager) {}

  async list(): Promise<SavedCommunicationCardRecord[]> {
    const connection = await this.database.initialize();
    const rows = await connection.getAllAsync<CardRow>(
      "SELECT id, journey_id, payload, saved_at FROM journey_cards ORDER BY saved_at DESC"
    );
    return rows.map((row) => {
      const card = parseJson(row.payload);
      if (!isRecord(card)) throw new JourneyStorageError("malformed-payload");
      return {
        id: row.id,
        journeyId: row.journey_id,
        card: card as SavedCommunicationCardRecord["card"],
        savedAt: row.saved_at
      };
    });
  }

  async save(record: SavedCommunicationCardRecord): Promise<void> {
    const connection = await this.database.initialize();
    await connection.runAsync(
      "INSERT INTO journey_cards (id, journey_id, payload, saved_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET journey_id = excluded.journey_id, payload = excluded.payload, saved_at = excluded.saved_at",
      record.id,
      record.journeyId,
      JSON.stringify(record.card),
      record.savedAt
    );
  }

  async delete(id: string): Promise<void> {
    const connection = await this.database.initialize();
    await connection.runAsync("DELETE FROM journey_cards WHERE id = ?", id);
  }
}

import type {
  EncryptedDatabaseManager,
  TransactionalEncryptedDatabaseManager
} from "../../../core/storage/database";
import {
  migrateLegacyCommunicationCard,
  migrateJourneyDraftV1ToV3,
  migrateJourneyDraftV2ToV3
} from "../domain/migrate-journey-draft";
import {
  type JourneyDraft,
  type SavedCommunicationCardMetadata,
  type SavedCommunicationCardRecord
} from "../domain/types";
import {
  isCommunicationCard,
  isJourneyDraftV1,
  isJourneyDraftV2,
  isJourneyDraftV3,
  isLegacyCommunicationCard
} from "../domain/journey-draft-schema";
import {
  JourneyStorageError,
  type CommunicationCardRepository,
  type JourneyDraftRepository
} from "./journey-draft-repository";

type DraftRow = { schema_version: number; payload: string };
type MigrationReceiptRow = { migration_id: string };
type CardRow = { id: string; journey_id: string; payload: string; saved_at: string };
type CardMetadataRow = { id: string; journey_id: string; saved_at: string };

function parseJson(payload: string): unknown {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    throw new JourneyStorageError("malformed-payload");
  }
}

export class SqlJourneyDraftRepository implements JourneyDraftRepository {
  constructor(private readonly database: TransactionalEncryptedDatabaseManager) {}

  async loadActive(): Promise<JourneyDraft | null> {
    const connection = await this.database.initialize();
    const row = await connection.getFirstAsync<DraftRow>(
      "SELECT schema_version, payload FROM journey_drafts_v3 ORDER BY updated_at DESC LIMIT 1"
    );
    if (row !== null) {
      if (row.schema_version !== 3) throw new JourneyStorageError("unsupported-schema");
      const value = parseJson(row.payload);
      if (!isJourneyDraftV3(value)) throw new JourneyStorageError("malformed-payload");
      return value;
    }

    return await this.database.withTransaction(async (connection) => {
      const concurrentRow = await connection.getFirstAsync<DraftRow>(
        "SELECT schema_version, payload FROM journey_drafts_v3 ORDER BY updated_at DESC LIMIT 1"
      );
      if (concurrentRow !== null) {
        if (concurrentRow.schema_version !== 3) throw new JourneyStorageError("unsupported-schema");
        const concurrentValue = parseJson(concurrentRow.payload);
        if (!isJourneyDraftV3(concurrentValue)) throw new JourneyStorageError("malformed-payload");
        return concurrentValue;
      }

      const v2Row = await connection.getFirstAsync<DraftRow>(
        "SELECT schema_version, payload FROM journey_drafts_v2 ORDER BY updated_at DESC LIMIT 1"
      );
      if (v2Row !== null) {
        if (v2Row.schema_version !== 2) throw new JourneyStorageError("unsupported-schema");
        const v2Value = parseJson(v2Row.payload);
        if (!isJourneyDraftV2(v2Value)) throw new JourneyStorageError("malformed-payload");
        const migrated = migrateJourneyDraftV2ToV3(v2Value);
        if (!isJourneyDraftV3(migrated)) throw new JourneyStorageError("malformed-payload");
        await connection.runAsync(
          "INSERT INTO journey_drafts_v3 (id, schema_version, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET schema_version = excluded.schema_version, payload = excluded.payload, created_at = excluded.created_at, updated_at = excluded.updated_at",
          migrated.id,
          migrated.schemaVersion,
          JSON.stringify(migrated),
          migrated.createdAt,
          migrated.updatedAt
        );
        return migrated;
      }

      const legacyRow = await connection.getFirstAsync<DraftRow>(
        "SELECT schema_version, payload FROM journey_drafts ORDER BY updated_at DESC LIMIT 1"
      );
      if (legacyRow === null) {
        return null;
      }
      if (legacyRow.schema_version !== 1) throw new JourneyStorageError("unsupported-schema");
      const legacyValue = parseJson(legacyRow.payload);
      if (!isJourneyDraftV1(legacyValue)) throw new JourneyStorageError("malformed-payload");
      const receipt = await connection.getFirstAsync<MigrationReceiptRow>(
        "SELECT migration_id FROM journey_migration_receipts WHERE source_draft_id = ? AND source_schema_version = 1 LIMIT 1",
        legacyValue.id
      );
      if (receipt !== null) {
        return null;
      }
      const migrated = migrateJourneyDraftV1ToV3(legacyValue);
      if (!isJourneyDraftV3(migrated)) throw new JourneyStorageError("malformed-payload");

      await connection.runAsync(
        "INSERT INTO journey_drafts_v3 (id, schema_version, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET schema_version = excluded.schema_version, payload = excluded.payload, created_at = excluded.created_at, updated_at = excluded.updated_at",
        migrated.id,
        migrated.schemaVersion,
        JSON.stringify(migrated),
        migrated.createdAt,
        migrated.updatedAt
      );
      await connection.runAsync(
        "INSERT INTO journey_migration_receipts (migration_id, source_draft_id, target_draft_id, source_schema_version, target_schema_version, migrated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(migration_id) DO NOTHING",
        `journey-draft-v1-v3:${legacyValue.id}`,
        legacyValue.id,
        migrated.id,
        1,
        3,
        migrated.updatedAt
      );
      return migrated;
    });
  }

  async saveActive(draft: JourneyDraft): Promise<void> {
    const connection = await this.database.initialize();
    await connection.runAsync(
      "INSERT INTO journey_drafts_v3 (id, schema_version, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET schema_version = excluded.schema_version, payload = excluded.payload, created_at = excluded.created_at, updated_at = excluded.updated_at",
      draft.id,
      draft.schemaVersion,
      JSON.stringify(draft),
      draft.createdAt,
      draft.updatedAt
    );
  }

  async deleteActive(): Promise<void> {
    await this.database.withTransaction(async (connection) => {
      await connection.runAsync("DELETE FROM journey_drafts_v3");
      await connection.runAsync("DELETE FROM journey_drafts_v2");
      await connection.runAsync("DELETE FROM journey_drafts");
    });
  }
}

export class SqlCommunicationCardRepository implements CommunicationCardRepository {
  constructor(private readonly database: EncryptedDatabaseManager) {}

  private parseRecord(row: CardRow): SavedCommunicationCardRecord {
    const card = parseJson(row.payload);
    if (!isCommunicationCard(card) && !isLegacyCommunicationCard(card)) {
      throw new JourneyStorageError("malformed-payload");
    }
    return {
      id: row.id,
      journeyId: row.journey_id,
      card: isCommunicationCard(card)
        ? card
        : migrateLegacyCommunicationCard(card as Record<string, never>),
      savedAt: row.saved_at
    };
  }

  async list(): Promise<SavedCommunicationCardRecord[]> {
    const connection = await this.database.initialize();
    const rows = await connection.getAllAsync<CardRow>(
      "SELECT id, journey_id, payload, saved_at FROM journey_cards ORDER BY saved_at DESC"
    );
    return rows.map((row) => this.parseRecord(row));
  }

  async listMetadata(): Promise<SavedCommunicationCardMetadata[]> {
    const connection = await this.database.initialize();
    const rows = await connection.getAllAsync<CardMetadataRow>(
      "SELECT id, journey_id, saved_at FROM journey_cards ORDER BY saved_at DESC"
    );
    return rows.map((row) => ({
      id: row.id,
      journeyId: row.journey_id,
      savedAt: row.saved_at
    }));
  }

  async load(id: string): Promise<SavedCommunicationCardRecord | null> {
    const connection = await this.database.initialize();
    const row = await connection.getFirstAsync<CardRow>(
      "SELECT id, journey_id, payload, saved_at FROM journey_cards WHERE id = ?",
      id
    );
    return row === null ? null : this.parseRecord(row);
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

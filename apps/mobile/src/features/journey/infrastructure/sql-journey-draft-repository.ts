import type { EncryptedDatabaseManager } from "../../../core/storage/database";
import {
  migrateLegacyCommunicationCard,
  migrateJourneyDraftV1ToV2,
  type JourneyDraftV1
} from "../domain/migrate-journey-draft";
import {
  COMMUNICATION_SECTION_IDS,
  type JourneyDraft,
  type SavedCommunicationCardMetadata,
  type SavedCommunicationCardRecord
} from "../domain/types";
import {
  JourneyStorageError,
  type CommunicationCardRepository,
  type JourneyDraftRepository
} from "./journey-draft-repository";

type DraftRow = { schema_version: number; payload: string };
type MigrationReceiptRow = { migration_id: string };
type CardRow = { id: string; journey_id: string; payload: string; saved_at: string };
type CardMetadataRow = { id: string; journey_id: string; saved_at: string };

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isBehaviorAttitudes(value: unknown): value is JourneyDraft["behaviorAttitudes"] {
  return isRecord(value) && Object.values(value).every((attitude) => isOneOf(attitude, [
    "looking-forward", "decide-in-moment", "unsure", "not-this-time", "skip"
  ]));
}

function isCustomBehaviors(value: unknown): value is JourneyDraft["customBehaviors"] {
  return Array.isArray(value) && value.every((entry) => isRecord(entry)
    && typeof entry.id === "string"
    && typeof entry.label === "string");
}

function isPractice(value: unknown): value is JourneyDraft["practice"] {
  return isRecord(value)
    && typeof value.completed === "boolean"
    && typeof value.mirrorRehearsed === "boolean"
    && isOptionalString(value.behaviorId)
    && isOptionalString(value.intent)
    && isOptionalString(value.selectedPhraseId)
    && isOptionalString(value.editedPhrase)
    && isOptionalString(value.partnerResponseBranch)
    && isOptionalString(value.responseId)
    && isOptionalString(value.catalogVersion)
    && isOptionalString(value.reflectionNote);
}

function isChecklistItems(value: unknown): value is JourneyDraft["privatePreparation"]["items"] {
  return Array.isArray(value) && value.every((entry) => isRecord(entry)
    && typeof entry.id === "string"
    && isOneOf(entry.category, [
      "attitude", "expression", "comfort", "communication", "logistics", "health", "aftercare"
    ])
    && isStringArray(entry.sourceIds)
    && isOneOf(entry.status, ["considered", "prepare-more", "not-relevant"])
    && isOptionalString(entry.userNote));
}

function isCommunicationCard(value: unknown): value is JourneyDraft["communicationCard"] {
  return isRecord(value)
    && Object.keys(value).length === COMMUNICATION_SECTION_IDS.length
    && COMMUNICATION_SECTION_IDS.every((sectionId) => isRecord(value[sectionId])
    && typeof value[sectionId].generatedText === "string"
    && isOptionalString(value[sectionId].userText)
    && typeof value[sectionId].sourceRevision === "number"
    && Number.isInteger(value[sectionId].sourceRevision)
    && value[sectionId].sourceRevision >= 0
    && typeof value[sectionId].needsReview === "boolean"
    && isOneOf(value[sectionId].visibility, ["pending", "included", "private", "deleted"]));
}

function isOvernightState(value: unknown): value is JourneyDraft["overnight"] {
  return isRecord(value)
    && isOneOf(value.stage, ["expectations", "concerns"])
    && isOneOf(value.resumeStage, ["expectations", "concerns"]);
}

function isReflection(value: unknown): value is JourneyDraft["reflection"] {
  return isRecord(value)
    && (value.pressureWithoutDisappointment === null || typeof value.pressureWithoutDisappointment === "string")
    && (value.refusalSafety === null || typeof value.refusalSafety === "string")
    && (value.expressionDifficulty === null || typeof value.expressionDifficulty === "string")
    && (value.comfortClarity === null || typeof value.comfortClarity === "string")
    && typeof value.comfortNote === "string";
}

function isJournal(value: unknown): value is JourneyDraft["journal"] {
  return isRecord(value)
    && isOptionalString(value.promptId)
    && typeof value.text === "string"
    && isOneOf(value.saveChoice, ["device", "not-saved"])
    && isOptionalString(value.savedAt);
}

function isPrivatePreparation(value: unknown): value is JourneyDraft["privatePreparation"] {
  return isRecord(value)
    && isChecklistItems(value.items)
    && isStringArray(value.excludedGroupIds)
    && isStringArray(value.aftercareIds)
    && isOptionalString(value.customNeed);
}

function isLegacyCommunicationCard(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Object.values(value).every((field) => isRecord(field)
    && typeof field.generatedText === "string"
    && isOptionalString(field.userText)
    && typeof field.sourceRevision === "number"
    && Number.isInteger(field.sourceRevision)
    && field.sourceRevision >= 0
    && typeof field.needsReview === "boolean");
}

function isLegacyPractice(value: unknown): value is JourneyDraftV1["practice"] {
  return isRecord(value)
    && typeof value.completed === "boolean"
    && isOptionalString(value.behaviorId)
    && isOptionalString(value.intent)
    && isOptionalString(value.selectedPhraseId)
    && isOptionalString(value.editedPhrase)
    && isOptionalString(value.partnerResponseBranch)
    && isOptionalString(value.responseId)
    && isOptionalString(value.catalogVersion)
    && isOptionalString(value.reflectionNote);
}

function isJourneyDraftV1(value: unknown): value is JourneyDraftV1 {
  if (!isRecord(value)) return false;
  return value.schemaVersion === 1
    && typeof value.id === "string"
    && isOneOf(value.currentPage, [
      "welcome", "overnight", "body-knowledge", "behavior-attitudes", "reflection",
      "preset-practice", "checklist", "communication-card"
    ])
    && typeof value.ageConfirmed === "boolean"
    && typeof value.prefaceRead === "boolean"
    && isStringArray(value.expectationIds)
    && isStringArray(value.concernIds)
    && typeof value.overnightCustomNote === "string"
    && isStringArray(value.readKnowledgeCardIds)
    && typeof value.medicalDiagramOpened === "boolean"
    && isBehaviorAttitudes(value.behaviorAttitudes)
    && isCustomBehaviors(value.customBehaviors)
    && isStringArray(value.motivationIds)
    && isStringArray(value.comfortNeedIds)
    && (typeof value.expressionSupportNeeded === "boolean" || value.expressionSupportNeeded === null)
    && isOneOf(value.journalSaveChoice, ["device", "not-saved"])
    && value.cloudSaveAvailability === "coming-soon"
    && isLegacyPractice(value.practice)
    && isChecklistItems(value.checklistItems)
    && isLegacyCommunicationCard(value.communicationCard)
    && isStringArray(value.pointEventKeys)
    && typeof value.sourceRevision === "number"
    && Number.isInteger(value.sourceRevision)
    && value.sourceRevision >= 0
    && typeof value.createdAt === "string"
    && typeof value.updatedAt === "string";
}

function isJourneyDraft(value: unknown): value is JourneyDraft {
  if (!isRecord(value)) return false;
  return value.schemaVersion === 2
    && typeof value.id === "string"
    && isOneOf(value.currentPage, [
      "body-knowledge", "overnight", "behavior-map", "reflection",
      "preset-practice", "final-preparation"
    ])
    && typeof value.ageConfirmed === "boolean"
    && (value.addressPreference === null || value.addressPreference === "你" || value.addressPreference === "妳")
    && typeof value.prefaceRead === "boolean"
    && (typeof value.explicitContentConsent === "boolean" || value.explicitContentConsent === null)
    && isOvernightState(value.overnight)
    && isStringArray(value.expectationIds)
    && isStringArray(value.concernIds)
    && typeof value.overnightCustomNote === "string"
    && isStringArray(value.readKnowledgeCardIds)
    && typeof value.medicalDiagramOpened === "boolean"
    && isBehaviorAttitudes(value.behaviorAttitudes)
    && isCustomBehaviors(value.customBehaviors)
    && isStringArray(value.motivationIds)
    && isStringArray(value.comfortNeedIds)
    && (typeof value.expressionSupportNeeded === "boolean" || value.expressionSupportNeeded === null)
    && isReflection(value.reflection)
    && (value.journalSaveChoice === "device" || value.journalSaveChoice === "not-saved")
    && isJournal(value.journal)
    && isPractice(value.practice)
    && isPrivatePreparation(value.privatePreparation)
    && isCommunicationCard(value.communicationCard)
    && isStringArray(value.pointEventKeys)
    && typeof value.sourceRevision === "number"
    && Number.isInteger(value.sourceRevision)
    && value.sourceRevision >= 0
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
      "SELECT schema_version, payload FROM journey_drafts_v2 ORDER BY updated_at DESC LIMIT 1"
    );
    if (row !== null) {
      if (row.schema_version !== 2) throw new JourneyStorageError("unsupported-schema");
      const value = parseJson(row.payload);
      if (!isJourneyDraft(value)) throw new JourneyStorageError("malformed-payload");
      return value;
    }

    await connection.execAsync("BEGIN IMMEDIATE");
    try {
      const concurrentRow = await connection.getFirstAsync<DraftRow>(
        "SELECT schema_version, payload FROM journey_drafts_v2 ORDER BY updated_at DESC LIMIT 1"
      );
      if (concurrentRow !== null) {
        if (concurrentRow.schema_version !== 2) throw new JourneyStorageError("unsupported-schema");
        const concurrentValue = parseJson(concurrentRow.payload);
        if (!isJourneyDraft(concurrentValue)) throw new JourneyStorageError("malformed-payload");
        await connection.execAsync("COMMIT");
        return concurrentValue;
      }

      const legacyRow = await connection.getFirstAsync<DraftRow>(
        "SELECT schema_version, payload FROM journey_drafts ORDER BY updated_at DESC LIMIT 1"
      );
      if (legacyRow === null) {
        await connection.execAsync("COMMIT");
        return null;
      }
      if (legacyRow.schema_version !== 1) throw new JourneyStorageError("unsupported-schema");
      const legacyValue = parseJson(legacyRow.payload);
      if (!isJourneyDraftV1(legacyValue)) throw new JourneyStorageError("malformed-payload");
      const receipt = await connection.getFirstAsync<MigrationReceiptRow>(
        "SELECT migration_id FROM journey_migration_receipts WHERE source_draft_id = ? AND source_schema_version = 1 AND target_schema_version = 2 LIMIT 1",
        legacyValue.id
      );
      if (receipt !== null) {
        await connection.execAsync("COMMIT");
        return null;
      }
      const migrated = migrateJourneyDraftV1ToV2(legacyValue);
      if (!isJourneyDraft(migrated)) throw new JourneyStorageError("malformed-payload");

      await connection.runAsync(
        "INSERT INTO journey_drafts_v2 (id, schema_version, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET schema_version = excluded.schema_version, payload = excluded.payload, created_at = excluded.created_at, updated_at = excluded.updated_at",
        migrated.id,
        migrated.schemaVersion,
        JSON.stringify(migrated),
        migrated.createdAt,
        migrated.updatedAt
      );
      await connection.runAsync(
        "INSERT INTO journey_migration_receipts (migration_id, source_draft_id, target_draft_id, source_schema_version, target_schema_version, migrated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(migration_id) DO NOTHING",
        `journey-draft-v1-v2:${legacyValue.id}`,
        legacyValue.id,
        migrated.id,
        1,
        2,
        migrated.updatedAt
      );
      await connection.execAsync("COMMIT");
      return migrated;
    } catch (error) {
      await connection.execAsync("ROLLBACK");
      throw error;
    }
  }

  async saveActive(draft: JourneyDraft): Promise<void> {
    const connection = await this.database.initialize();
    await connection.runAsync(
      "INSERT INTO journey_drafts_v2 (id, schema_version, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET schema_version = excluded.schema_version, payload = excluded.payload, created_at = excluded.created_at, updated_at = excluded.updated_at",
      draft.id,
      draft.schemaVersion,
      JSON.stringify(draft),
      draft.createdAt,
      draft.updatedAt
    );
  }

  async deleteActive(): Promise<void> {
    const connection = await this.database.initialize();
    await connection.execAsync("BEGIN IMMEDIATE");
    try {
      await connection.runAsync("DELETE FROM journey_drafts_v2");
      await connection.runAsync("DELETE FROM journey_drafts");
      await connection.execAsync("COMMIT");
    } catch (error) {
      await connection.execAsync("ROLLBACK");
      throw error;
    }
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

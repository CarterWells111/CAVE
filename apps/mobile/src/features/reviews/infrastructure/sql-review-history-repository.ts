import type { EncryptedDatabaseManager } from "../../../core/storage/database";
import {
  isJourneyDraftV1,
  isJourneyDraftV2,
  isJourneyDraftV3,
  isRecord
} from "../../journey/domain/journey-draft-schema";
import {
  migrateJourneyDraftV1ToV3,
  migrateJourneyDraftV2ToV3
} from "../../journey/domain/migrate-journey-draft";
import type { JourneyDraft } from "../../journey/domain/types";
import { JourneyStorageError } from "../../journey/infrastructure/journey-draft-repository";
import type {
  ActiveReview,
  ReviewBranchSeed,
  ReviewHistoryRepository,
  ReviewVersionDetail,
  ReviewVersionInput,
  ReviewVersionMetadata,
} from "./review-history-repository";

type ActiveRow = { root_id: string; base_version_id: string | null; payload: string; created_at: string; updated_at: string };
type VersionRow = { id: string; root_id: string; parent_version_id: string | null; title: string; review_date: string; status: "completed" | "incomplete"; payload: string; source_revision: number; created_at: string };
type MetadataRow = Omit<VersionRow, "payload" | "source_revision">;

export interface ReviewPayloadCodec<Payload> {
  decode(value: unknown): Payload;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new JourneyStorageError("malformed-payload");
  }
}

export const journeyDraftReviewPayloadCodec: ReviewPayloadCodec<JourneyDraft> = {
  decode(value) {
    if (!isRecord(value) || !("schemaVersion" in value)) {
      throw new JourneyStorageError("malformed-payload");
    }
    if (value.schemaVersion === 1) {
      if (!isJourneyDraftV1(value)) throw new JourneyStorageError("malformed-payload");
      return migrateJourneyDraftV1ToV3(value);
    }
    if (value.schemaVersion === 2) {
      if (!isJourneyDraftV2(value)) throw new JourneyStorageError("malformed-payload");
      return migrateJourneyDraftV2ToV3(value);
    }
    if (value.schemaVersion === 3) {
      if (!isJourneyDraftV3(value)) throw new JourneyStorageError("malformed-payload");
      return value;
    }
    if (typeof value.schemaVersion === "number") {
      throw new JourneyStorageError("unsupported-schema");
    }
    throw new JourneyStorageError("malformed-payload");
  }
};

export class SqlReviewHistoryRepository<Payload> implements ReviewHistoryRepository<Payload> {
  constructor(
    private readonly database: EncryptedDatabaseManager,
    private readonly payloadCodec: ReviewPayloadCodec<Payload>
  ) {}

  private parsePayload(value: string): Payload {
    return this.payloadCodec.decode(parseJson(value));
  }

  async loadActive(): Promise<ActiveReview<Payload> | null> {
    const db = await this.database.initialize();
    const row = await db.getFirstAsync<ActiveRow>("SELECT root_id, base_version_id, payload, created_at, updated_at FROM journey_active_review WHERE singleton_id = 1");
    if (row === null) return null;
    return { id: `active:${row.root_id}`, rootId: row.root_id, sourceVersionId: row.base_version_id, title: "本次回顾", updatedAt: row.updated_at, payload: this.parsePayload(row.payload) };
  }

  async saveActive(review: ActiveReview<Payload>): Promise<void> {
    const db = await this.database.initialize();
    await db.runAsync(
      "INSERT INTO journey_active_review (singleton_id, root_id, base_version_id, payload, created_at, updated_at) VALUES (1, ?, ?, ?, ?, ?) ON CONFLICT(singleton_id) DO UPDATE SET root_id = excluded.root_id, base_version_id = excluded.base_version_id, payload = excluded.payload, updated_at = excluded.updated_at",
      review.rootId, review.sourceVersionId, JSON.stringify(review.payload), review.updatedAt, review.updatedAt,
    );
  }

  async clearActive(): Promise<void> {
    const db = await this.database.initialize();
    await db.runAsync("DELETE FROM journey_active_review WHERE singleton_id = 1");
  }

  async appendVersion(version: ReviewVersionInput<Payload>): Promise<void> {
    const db = await this.database.initialize();
    await db.runAsync(
      "INSERT INTO journey_review_versions (id, root_id, parent_version_id, title, review_date, status, payload, source_revision, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      version.id, version.rootId, version.parentVersionId, version.title, version.createdAt.slice(0, 10), version.status,
      JSON.stringify(version.payload), (version.payload as { sourceRevision?: number }).sourceRevision ?? 0, version.createdAt,
    );
  }

  async appendVersionAndClearActive(version: ReviewVersionInput<Payload>): Promise<void> {
    const db = await this.database.initialize();
    await db.execAsync("BEGIN IMMEDIATE");
    try {
      await db.runAsync(
        "INSERT INTO journey_review_versions (id, root_id, parent_version_id, title, review_date, status, payload, source_revision, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        version.id, version.rootId, version.parentVersionId, version.title, version.createdAt.slice(0, 10), version.status,
        JSON.stringify(version.payload), (version.payload as { sourceRevision?: number }).sourceRevision ?? 0, version.createdAt,
      );
      await db.runAsync("DELETE FROM journey_active_review WHERE singleton_id = 1");
      await db.execAsync("COMMIT");
    } catch (error) { await db.execAsync("ROLLBACK"); throw error; }
  }

  async listMetadata(): Promise<ReadonlyArray<ReviewVersionMetadata>> {
    const db = await this.database.initialize();
    const rows = await db.getAllAsync<MetadataRow>("SELECT id, root_id, parent_version_id, title, review_date, status, created_at FROM journey_review_versions ORDER BY review_date DESC, created_at DESC");
    return rows.map((row) => ({ id: row.id, rootId: row.root_id, parentVersionId: row.parent_version_id, title: row.title, createdAt: row.created_at, status: row.status }));
  }

  async loadDetail(id: string): Promise<ReviewVersionDetail<Payload> | null> {
    const db = await this.database.initialize();
    const row = await db.getFirstAsync<VersionRow>("SELECT id, root_id, parent_version_id, title, review_date, status, payload, source_revision, created_at FROM journey_review_versions WHERE id = ?", id);
    return row === null ? null : { id: row.id, rootId: row.root_id, parentVersionId: row.parent_version_id, title: row.title, createdAt: row.created_at, status: row.status, payload: this.parsePayload(row.payload) };
  }

  async loadBranchSeed(id: string): Promise<ReviewBranchSeed<Payload> | null> {
    const detail = await this.loadDetail(id);
    return detail === null ? null : { rootId: detail.rootId, sourceVersionId: detail.id, suggestedTitle: detail.title, payload: detail.payload };
  }

  async deleteVersion(id: string): Promise<boolean> {
    const db = await this.database.initialize();
    await db.execAsync("BEGIN IMMEDIATE");
    try {
      const existing = await db.getFirstAsync<{ id: string }>("SELECT id FROM journey_review_versions WHERE id = ?", id);
      if (existing === null) { await db.execAsync("COMMIT"); return false; }
      await db.runAsync("UPDATE journey_review_versions SET parent_version_id = NULL WHERE parent_version_id = ?", id);
      await db.runAsync("UPDATE journey_active_review SET base_version_id = NULL WHERE base_version_id = ?", id);
      await db.runAsync("DELETE FROM journey_review_versions WHERE id = ?", id);
      await db.execAsync("COMMIT");
      return true;
    } catch (error) {
      await db.execAsync("ROLLBACK");
      throw error;
    }
  }

  async clearAll(): Promise<void> {
    const db = await this.database.initialize();
    await db.execAsync("BEGIN IMMEDIATE");
    try {
      await db.runAsync("DELETE FROM journey_active_review");
      await db.runAsync("DELETE FROM journey_review_versions");
      await db.execAsync("COMMIT");
    } catch (error) {
      await db.execAsync("ROLLBACK");
      throw error;
    }
  }
}

import type { TransactionalEncryptedDatabaseManager } from "../../../core/storage/database";
import type { ActiveReview } from "../../reviews/infrastructure/review-history-repository";
import type { JourneyDraft } from "../domain/types";
import type { JourneyBranchTransaction, JourneyBranchWriteCoordinator, JourneyCompletionTransaction, JourneyWriteCoordinator } from "./journey-write-coordinator";

export class SqlJourneyTransactionRepository implements JourneyWriteCoordinator, JourneyBranchWriteCoordinator {
  constructor(private readonly database: TransactionalEncryptedDatabaseManager) {}

  async saveActive(draft: JourneyDraft, active: ActiveReview<JourneyDraft>): Promise<void> {
    await this.database.withTransaction(async (db) => {
      await db.runAsync(
        "INSERT INTO journey_drafts_v3 (id, schema_version, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET schema_version = excluded.schema_version, payload = excluded.payload, created_at = excluded.created_at, updated_at = excluded.updated_at",
        draft.id, draft.schemaVersion, JSON.stringify(draft), draft.createdAt, draft.updatedAt,
      );
      await db.runAsync(
        "INSERT INTO journey_active_review (singleton_id, root_id, base_version_id, payload, created_at, updated_at) VALUES (1, ?, ?, ?, ?, ?) ON CONFLICT(singleton_id) DO UPDATE SET root_id = excluded.root_id, base_version_id = excluded.base_version_id, payload = excluded.payload, updated_at = excluded.updated_at",
        active.rootId, active.sourceVersionId, JSON.stringify(active.payload), active.updatedAt, active.updatedAt,
      );
    });
  }

  async branch({ archivedActive, branch, active }: JourneyBranchTransaction): Promise<void> {
    await this.database.withTransaction(async (db) => {
      if (archivedActive !== null) {
        await db.runAsync(
          "INSERT INTO journey_review_versions (id, root_id, parent_version_id, title, review_date, status, payload, source_revision, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
          archivedActive.id, archivedActive.rootId, archivedActive.parentVersionId, archivedActive.title,
          archivedActive.createdAt.slice(0, 10), archivedActive.status, JSON.stringify(archivedActive.payload),
          archivedActive.payload.sourceRevision, archivedActive.createdAt,
        );
      }
      await db.runAsync("DELETE FROM journey_drafts_v3");
      await db.runAsync("DELETE FROM journey_drafts_v2");
      await db.runAsync("DELETE FROM journey_drafts");
      await db.runAsync(
        "INSERT INTO journey_drafts_v3 (id, schema_version, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        branch.id, branch.schemaVersion, JSON.stringify(branch), branch.createdAt, branch.updatedAt,
      );
      await db.runAsync(
        "INSERT INTO journey_active_review (singleton_id, root_id, base_version_id, payload, created_at, updated_at) VALUES (1, ?, ?, ?, ?, ?) ON CONFLICT(singleton_id) DO UPDATE SET root_id = excluded.root_id, base_version_id = excluded.base_version_id, payload = excluded.payload, created_at = excluded.created_at, updated_at = excluded.updated_at",
        active.rootId, active.sourceVersionId, JSON.stringify(active.payload), active.updatedAt, active.updatedAt,
      );
    });
  }

  async complete({ draft, card, version, shell }: JourneyCompletionTransaction): Promise<void> {
    await this.database.withTransaction(async (db) => {
      await db.runAsync(
        "INSERT INTO journey_cards (id, journey_id, payload, saved_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET journey_id = excluded.journey_id, payload = excluded.payload, saved_at = excluded.saved_at",
        card.id, card.journeyId, JSON.stringify(card.card), card.savedAt,
      );
      await db.runAsync(
        "INSERT INTO journey_review_versions (id, root_id, parent_version_id, title, review_date, status, payload, source_revision, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
        version.id, version.rootId, version.parentVersionId, version.title, version.createdAt.slice(0, 10), version.status,
        JSON.stringify(version.payload), draft.sourceRevision, version.createdAt,
      );
      await db.runAsync("DELETE FROM journey_active_review WHERE singleton_id = 1");
      await db.runAsync(
        "INSERT INTO app_shell_state (singleton_id, initial_journey_completed_at, initial_journey_id) VALUES (1, ?, ?) ON CONFLICT(singleton_id) DO NOTHING",
        shell.initialJourneyCompletedAt, shell.initialJourneyId,
      );
      await db.runAsync("DELETE FROM journey_drafts_v3");
      await db.runAsync("DELETE FROM journey_drafts_v2");
      await db.runAsync("DELETE FROM journey_drafts");
    });
  }
}

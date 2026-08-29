import type {
  DatabaseTransactionConnection,
  ManagedDatabaseConnection,
} from "../../../core/storage/database";
import type { JournalEntry, JournalRecord } from "../domain/journal-record";
import { normalizeJournalDate } from "../domain/journal-date";
import {
  JournalDeletionCleanupRequiredError,
  type JournalPeriodReview,
  type JournalRecordSummary,
  type JournalRepository,
} from "./journal-repository";

type RecordRow = {
  id: string; title: string; occurred_at: string; created_at: string; updated_at: string; editable_until: string;
  highlight_kind: JournalRecord["highlight"]["kind"]; highlight_text: string; body: string;
  topics_json: string; source_json: string; card_snapshot_json: string | null;
};
type EntryRow = {
  id: string; record_id: string; kind: JournalEntry["kind"]; occurred_at: string; created_at: string;
  updated_at: string; editable_until: string; highlight_json: string | null; body: string;
};
type ReviewRow = {
  id: string; period_start: string; period_end: string; created_at: string; updated_at: string;
  editable_until: string; title: string; body: string; source_record_ids_json: string;
};

const parse = <T>(value: string): T => JSON.parse(value) as T;
const mapRecord = (row: RecordRow): JournalRecord => ({
  id: row.id, title: row.title, occurredAt: normalizeJournalDate(row.occurred_at), createdAt: row.created_at,
  updatedAt: row.updated_at, editableUntil: row.editable_until,
  highlight: { kind: row.highlight_kind, text: row.highlight_text }, body: row.body,
  topics: parse(row.topics_json), source: parse(row.source_json),
  cardSnapshot: row.card_snapshot_json === null ? null : parse(row.card_snapshot_json)
});
const mapEntry = (row: EntryRow): JournalEntry => ({
  id: row.id, recordId: row.record_id, kind: row.kind, occurredAt: normalizeJournalDate(row.occurred_at),
  createdAt: row.created_at, updatedAt: row.updated_at, editableUntil: row.editable_until,
  highlight: row.highlight_json === null ? null : parse(row.highlight_json), body: row.body
});
const mapReview = (row: ReviewRow): JournalPeriodReview => ({
  id: row.id, periodStart: row.period_start, periodEnd: row.period_end, createdAt: row.created_at,
  updatedAt: row.updated_at, editableUntil: row.editable_until, title: row.title, body: row.body,
  sourceRecordIds: parse(row.source_record_ids_json)
});

export type JournalDatabaseManager = {
  initialize(): Promise<ManagedDatabaseConnection>;
  withTransaction<T>(
    operation: (connection: DatabaseTransactionConnection) => Promise<T>
  ): Promise<T>;
  markDeletionCleanupPending?(
    connection: DatabaseTransactionConnection,
  ): Promise<void>;
  markOwnerDeletionCleanupPending?(
    connection: DatabaseTransactionConnection,
    ownerAccountId: string,
  ): Promise<void>;
  clearOwnerDeletionMarker?(
    connection: DatabaseTransactionConnection,
    ownerAccountId: string,
  ): Promise<void>;
  checkpointAfterDeletion?(): Promise<void>;
  ensureDeletionCleanup?(ownerAccountId: string): Promise<boolean>;
};

export class SqlJournalRepository implements JournalRepository {
  constructor(private readonly database: JournalDatabaseManager) {}
  private connection() { return this.database.initialize(); }

  private async checkpointCommittedDeletion(
    ownerDeletionCommitted = false,
  ): Promise<void> {
    try {
      await this.database.checkpointAfterDeletion?.();
    } catch (error) {
      throw new JournalDeletionCleanupRequiredError(error, ownerDeletionCommitted);
    }
  }

  private async commitDeletion(
    operation: (connection: DatabaseTransactionConnection) => Promise<void>,
  ): Promise<void> {
    if (this.database.markDeletionCleanupPending === undefined) {
      await operation(await this.connection());
    } else {
      await this.database.withTransaction(async (connection) => {
        await this.database.markDeletionCleanupPending?.(connection);
        await operation(connection);
      });
    }
    await this.checkpointCommittedDeletion();
  }

  async ensureDeletionCleanup(ownerAccountId: string): Promise<boolean> {
    try {
      return await this.database.ensureDeletionCleanup?.(ownerAccountId) ?? false;
    } catch (error) {
      const cleanupPending = typeof error === "object"
        && error !== null
        && "cleanupPending" in error
        && error.cleanupPending === true;
      if (!cleanupPending) throw error;
      const ownerDeletionCommitted = typeof error === "object"
        && error !== null
        && "ownerDeletionCommitted" in error
        && error.ownerDeletionCommitted === true;
      throw new JournalDeletionCleanupRequiredError(error, ownerDeletionCommitted);
    }
  }

  async claimUnowned(ownerAccountId: string): Promise<void> {
    await this.database.withTransaction(async (db) => {
      await db.runAsync("UPDATE journal_records SET owner_account_id=? WHERE owner_account_id IS NULL", ownerAccountId);
      await db.runAsync("UPDATE journal_period_reviews SET owner_account_id=? WHERE owner_account_id IS NULL", ownerAccountId);
    });
  }

  async createRecord(ownerAccountId: string, record: JournalRecord): Promise<void> {
    const insert = async (db: DatabaseTransactionConnection) => {
      await db.runAsync("INSERT INTO journal_records (id,owner_account_id,title,occurred_at,created_at,updated_at,editable_until,highlight_kind,highlight_text,body,topics_json,source_json,card_snapshot_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        record.id, ownerAccountId, record.title, record.occurredAt, record.createdAt, record.updatedAt, record.editableUntil,
        record.highlight.kind, record.highlight.text, record.body, JSON.stringify(record.topics), JSON.stringify(record.source),
        record.cardSnapshot === null ? null : JSON.stringify(record.cardSnapshot));
    };
    if (this.database.clearOwnerDeletionMarker === undefined) {
      await insert(await this.connection());
    } else {
      await this.database.withTransaction(async (db) => {
        await this.database.clearOwnerDeletionMarker?.(db, ownerAccountId);
        await insert(db);
      });
    }
  }
  async updateRecord(ownerAccountId: string, record: JournalRecord): Promise<void> {
    const db = await this.connection();
    await db.runAsync("UPDATE journal_records SET title=?,occurred_at=?,updated_at=?,highlight_kind=?,highlight_text=?,body=?,topics_json=? WHERE id=? AND owner_account_id=?",
      record.title, record.occurredAt, record.updatedAt, record.highlight.kind, record.highlight.text, record.body, JSON.stringify(record.topics), record.id, ownerAccountId);
  }
  async listRecords(ownerAccountId: string): Promise<readonly JournalRecordSummary[]> {
    const db = await this.connection();
    const rows = await db.getAllAsync<Pick<RecordRow, "id" | "title" | "occurred_at" | "created_at" | "highlight_kind" | "highlight_text" | "topics_json">>(
      "SELECT id,title,occurred_at,created_at,highlight_kind,highlight_text,topics_json FROM journal_records WHERE owner_account_id=? ORDER BY occurred_at DESC, created_at DESC",
      ownerAccountId,
    );
    return rows
      .map((row) => ({ id: row.id, title: row.title, occurredAt: normalizeJournalDate(row.occurred_at), createdAt: row.created_at, highlight: { kind: row.highlight_kind, text: row.highlight_text }, topics: parse<JournalRecord["topics"]>(row.topics_json) }))
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.createdAt.localeCompare(left.createdAt));
  }
  async loadRecord(ownerAccountId: string, id: string): Promise<JournalRecord | null> {
    const db = await this.connection();
    const row = await db.getFirstAsync<RecordRow>("SELECT * FROM journal_records WHERE id=? AND owner_account_id=?", id, ownerAccountId);
    return row === null ? null : mapRecord(row);
  }
  async deleteRecord(ownerAccountId: string, id: string): Promise<void> {
    await this.commitDeletion(async (db) => {
      await db.runAsync("DELETE FROM journal_records WHERE id=? AND owner_account_id=?", id, ownerAccountId);
    });
  }
  async createEntry(ownerAccountId: string, entry: JournalEntry): Promise<void> {
    const db = await this.connection();
    await db.runAsync("INSERT INTO journal_entries (id,record_id,kind,occurred_at,created_at,updated_at,editable_until,highlight_json,body) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM journal_records WHERE id=? AND owner_account_id=?)",
      entry.id, entry.recordId, entry.kind, entry.occurredAt, entry.createdAt, entry.updatedAt, entry.editableUntil,
      entry.highlight === null ? null : JSON.stringify(entry.highlight), entry.body, entry.recordId, ownerAccountId);
  }
  async updateEntry(ownerAccountId: string, entry: JournalEntry): Promise<void> {
    const db = await this.connection();
    await db.runAsync("UPDATE journal_entries SET kind=?,occurred_at=?,updated_at=?,highlight_json=?,body=? WHERE id=? AND EXISTS (SELECT 1 FROM journal_records WHERE id=journal_entries.record_id AND owner_account_id=?)",
      entry.kind, entry.occurredAt, entry.updatedAt, entry.highlight === null ? null : JSON.stringify(entry.highlight), entry.body, entry.id, ownerAccountId);
  }
  async loadEntry(ownerAccountId: string, id: string): Promise<JournalEntry | null> { const db = await this.connection(); const row = await db.getFirstAsync<EntryRow>("SELECT journal_entries.* FROM journal_entries JOIN journal_records ON journal_records.id=journal_entries.record_id WHERE journal_entries.id=? AND journal_records.owner_account_id=?", id, ownerAccountId); return row === null ? null : mapEntry(row); }
  async deleteEntry(ownerAccountId: string, id: string): Promise<void> {
    await this.commitDeletion(async (db) => {
      await db.runAsync("DELETE FROM journal_entries WHERE id=? AND EXISTS (SELECT 1 FROM journal_records WHERE id=journal_entries.record_id AND owner_account_id=?)", id, ownerAccountId);
    });
  }
  async listEntries(ownerAccountId: string, recordId: string): Promise<readonly JournalEntry[]> { const db = await this.connection(); return (await db.getAllAsync<EntryRow>("SELECT journal_entries.* FROM journal_entries JOIN journal_records ON journal_records.id=journal_entries.record_id WHERE journal_entries.record_id=? AND journal_records.owner_account_id=? ORDER BY journal_entries.occurred_at, journal_entries.created_at", recordId, ownerAccountId)).map(mapEntry).sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.createdAt.localeCompare(right.createdAt)); }
  async savePeriodReview(ownerAccountId: string, review: JournalPeriodReview): Promise<void> {
    const db = await this.connection();
    const result = await db.runAsync(`INSERT INTO journal_period_reviews (id,owner_account_id,period_start,period_end,created_at,updated_at,editable_until,title,body,source_record_ids_json)
VALUES (?,?,?,?,?,?,?,?,?,?)
ON CONFLICT(id) DO UPDATE SET
  period_start=excluded.period_start,
  period_end=excluded.period_end,
  updated_at=excluded.updated_at,
  editable_until=excluded.editable_until,
  title=excluded.title,
  body=excluded.body,
  source_record_ids_json=excluded.source_record_ids_json
WHERE journal_period_reviews.owner_account_id=excluded.owner_account_id`,
      review.id, ownerAccountId, review.periodStart, review.periodEnd, review.createdAt, review.updatedAt, review.editableUntil, review.title, review.body, JSON.stringify(review.sourceRecordIds));
    if (result.changes !== 1) {
      throw new Error("journal-period-review-owner-conflict");
    }
  }
  async listPeriodReviews(ownerAccountId: string): Promise<readonly JournalPeriodReview[]> { const db = await this.connection(); return (await db.getAllAsync<ReviewRow>("SELECT * FROM journal_period_reviews WHERE owner_account_id=? ORDER BY created_at DESC", ownerAccountId)).map(mapReview); }
  async clearOwner(ownerAccountId: string): Promise<void> {
    await this.database.withTransaction(async (db) => {
      if (this.database.markOwnerDeletionCleanupPending === undefined) {
        await this.database.markDeletionCleanupPending?.(db);
      } else {
        await this.database.markOwnerDeletionCleanupPending(db, ownerAccountId);
      }
      await db.runAsync(
        "DELETE FROM journal_entries WHERE record_id IN (SELECT id FROM journal_records WHERE owner_account_id=?)",
        ownerAccountId,
      );
      await db.runAsync("DELETE FROM journal_period_reviews WHERE owner_account_id=?", ownerAccountId);
      await db.runAsync("DELETE FROM journal_records WHERE owner_account_id=?", ownerAccountId);
    });
    await this.checkpointCommittedDeletion(true);
  }
  async clearAll(): Promise<void> {
    await this.database.withTransaction(async (db) => {
      await this.database.markDeletionCleanupPending?.(db);
      await db.runAsync("DELETE FROM journal_period_reviews");
      await db.runAsync("DELETE FROM journal_entries");
      await db.runAsync("DELETE FROM journal_records");
      if (this.database.clearOwnerDeletionMarker !== undefined) {
        await db.runAsync("DELETE FROM journal_cleared_owners");
      }
    });
    await this.checkpointCommittedDeletion();
  }
}

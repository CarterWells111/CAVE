import type { JournalEntry, JournalRecord } from "../domain/journal-record";

export class JournalDeletionCleanupRequiredError extends Error {
  readonly code = "JOURNAL_DELETION_CLEANUP_REQUIRED";
  readonly deletionCommitted = true;
  override readonly cause?: unknown;

  constructor(
    cause?: unknown,
    readonly ownerDeletionCommitted = false,
  ) {
    super("Journal deletion committed but secure cleanup still needs retry");
    this.name = "JournalDeletionCleanupRequiredError";
    if (cause !== undefined) this.cause = cause;
  }
}

export type JournalRecordSummary = Pick<
  JournalRecord,
  "id" | "title" | "occurredAt" | "createdAt" | "highlight" | "topics"
>;

export type JournalPeriodReview = Readonly<{
  id: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  updatedAt: string;
  editableUntil: string;
  title: string;
  body: string;
  sourceRecordIds: readonly string[];
}>;

export type JournalDraft = Readonly<{
  title: string; occurredAt: string; highlight: JournalRecord["highlight"]; body: string;
  topics: JournalRecord["topics"]; source?: JournalRecord["source"]; cardSnapshot?: JournalRecord["cardSnapshot"];
}>;
export type JournalRevision = Readonly<{
  id: string; recordId: string; itemId: string; itemKind: "record" | "entry";
  savedAt: string; snapshot: JournalRecord | JournalEntry;
}>;

export interface JournalRepository {
  ensureDeletionCleanup(ownerAccountId: string): Promise<boolean>;
  claimUnowned(ownerAccountId: string): Promise<void>;
  createRecord(ownerAccountId: string, record: JournalRecord): Promise<void>;
  updateRecord(ownerAccountId: string, record: JournalRecord, revision?: JournalRevision): Promise<void>;
  listRecords(ownerAccountId: string): Promise<readonly JournalRecordSummary[]>;
  loadRecord(ownerAccountId: string, id: string): Promise<JournalRecord | null>;
  deleteRecord(ownerAccountId: string, id: string): Promise<void>;
  createEntry(ownerAccountId: string, entry: JournalEntry): Promise<void>;
  updateEntry(ownerAccountId: string, entry: JournalEntry, revision?: JournalRevision): Promise<void>;
  loadEntry(ownerAccountId: string, id: string): Promise<JournalEntry | null>;
  deleteEntry(ownerAccountId: string, id: string): Promise<void>;
  listEntries(ownerAccountId: string, recordId: string): Promise<readonly JournalEntry[]>;
  savePeriodReview(ownerAccountId: string, review: JournalPeriodReview): Promise<void>;
  listPeriodReviews(ownerAccountId: string): Promise<readonly JournalPeriodReview[]>;
  clearOwner(ownerAccountId: string): Promise<void>;
  clearAll(): Promise<void>;
  loadDraft(ownerAccountId: string, key: string): Promise<JournalDraft | null>;
  saveDraft(ownerAccountId: string, key: string, draft: JournalDraft): Promise<void>;
  clearDraft(ownerAccountId: string, key: string): Promise<void>;
  listRevisions(ownerAccountId: string, recordId: string): Promise<readonly JournalRevision[]>;
}

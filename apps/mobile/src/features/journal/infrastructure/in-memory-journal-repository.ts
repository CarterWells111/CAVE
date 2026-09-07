import type { JournalEntry, JournalRecord } from "../domain/journal-record";
import type { JournalDraft, JournalPeriodReview, JournalRecordSummary, JournalRepository, JournalRevision } from "./journal-repository";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class InMemoryJournalRepository implements JournalRepository {
  private readonly drafts = new Map<string, JournalDraft>();
  private readonly revisions = new Map<string, { owner: string; revision: JournalRevision }>();
  private readonly records = new Map<string, { ownerAccountId: string | null; record: JournalRecord }>();
  private readonly entries = new Map<string, JournalEntry>();
  private readonly reviews = new Map<string, { ownerAccountId: string | null; review: JournalPeriodReview }>();

  async ensureDeletionCleanup(): Promise<boolean> {
    return false;
  }

  async claimUnowned(ownerAccountId: string): Promise<void> {
    for (const [id, value] of this.records) {
      if (value.ownerAccountId === null) this.records.set(id, { ...value, ownerAccountId });
    }
    for (const [id, value] of this.reviews) {
      if (value.ownerAccountId === null) this.reviews.set(id, { ...value, ownerAccountId });
    }
  }

  async createRecord(ownerAccountId: string, record: JournalRecord): Promise<void> {
    if (this.records.has(record.id)) throw new Error("journal-record-conflict");
    this.records.set(record.id, { ownerAccountId, record: clone(record) });
  }

  async updateRecord(ownerAccountId: string, record: JournalRecord, revision?: JournalRevision): Promise<void> {
    const current = this.records.get(record.id);
    if (current?.ownerAccountId !== ownerAccountId) throw new Error("journal-record-not-found");
    this.records.set(record.id, { ownerAccountId, record: clone(record) });
    if (revision) this.revisions.set(revision.id, { owner: ownerAccountId, revision: clone(revision) });
  }

  async listRecords(ownerAccountId: string): Promise<readonly JournalRecordSummary[]> {
    return [...this.records.values()]
      .filter((value) => value.ownerAccountId === ownerAccountId)
      .map((value) => value.record)
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.createdAt.localeCompare(left.createdAt))
      .map(({ id, title, occurredAt, createdAt, highlight, topics }) => clone({ id, title, occurredAt, createdAt, highlight, topics }));
  }

  async loadRecord(ownerAccountId: string, id: string): Promise<JournalRecord | null> {
    const value = this.records.get(id);
    return value?.ownerAccountId === ownerAccountId ? clone(value.record) : null;
  }

  async deleteRecord(ownerAccountId: string, id: string): Promise<void> {
    if (this.records.get(id)?.ownerAccountId !== ownerAccountId) return;
    this.records.delete(id);
    for (const [key, value] of this.revisions) if (value.owner === ownerAccountId && value.revision.recordId === id) this.revisions.delete(key);
    this.drafts.delete(JSON.stringify([ownerAccountId, `record:${id}`]));
    for (const [entryId, entry] of this.entries) {
      if (entry.recordId === id) this.entries.delete(entryId);
    }
  }

  async createEntry(ownerAccountId: string, entry: JournalEntry): Promise<void> {
    if (this.records.get(entry.recordId)?.ownerAccountId !== ownerAccountId) throw new Error("journal-record-not-found");
    if (this.entries.has(entry.id)) throw new Error("journal-entry-conflict");
    this.entries.set(entry.id, clone(entry));
  }

  async updateEntry(ownerAccountId: string, entry: JournalEntry, revision?: JournalRevision): Promise<void> {
    if (this.records.get(entry.recordId)?.ownerAccountId !== ownerAccountId || !this.entries.has(entry.id)) throw new Error("journal-entry-not-found");
    this.entries.set(entry.id, clone(entry));
    if (revision) this.revisions.set(revision.id, { owner: ownerAccountId, revision: clone(revision) });
  }

  async loadEntry(ownerAccountId: string, id: string): Promise<JournalEntry | null> {
    const entry = this.entries.get(id);
    return entry !== undefined && this.records.get(entry.recordId)?.ownerAccountId === ownerAccountId ? clone(entry) : null;
  }

  async deleteEntry(ownerAccountId: string, id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (entry !== undefined && this.records.get(entry.recordId)?.ownerAccountId === ownerAccountId) {
      this.entries.delete(id);
      for (const [key, value] of this.revisions) if (value.owner === ownerAccountId && value.revision.itemId === id) this.revisions.delete(key);
    }
  }

  async listEntries(ownerAccountId: string, recordId: string): Promise<readonly JournalEntry[]> {
    if (this.records.get(recordId)?.ownerAccountId !== ownerAccountId) return [];
    return [...this.entries.values()]
      .filter((entry) => entry.recordId === recordId)
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.createdAt.localeCompare(right.createdAt))
      .map(clone);
  }

  async savePeriodReview(ownerAccountId: string, review: JournalPeriodReview): Promise<void> {
    this.reviews.set(review.id, { ownerAccountId, review: clone(review) });
  }

  async listPeriodReviews(ownerAccountId: string): Promise<readonly JournalPeriodReview[]> {
    return [...this.reviews.values()]
      .filter((value) => value.ownerAccountId === ownerAccountId)
      .map((value) => value.review)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map(clone);
  }

  async clearOwner(ownerAccountId: string): Promise<void> {
    for (const key of this.drafts.keys()) if ((JSON.parse(key) as string[])[0] === ownerAccountId) this.drafts.delete(key);
    for (const [id, value] of this.records) {
      if (value.ownerAccountId === ownerAccountId) await this.deleteRecord(ownerAccountId, id);
    }
    for (const [id, value] of this.reviews) {
      if (value.ownerAccountId === ownerAccountId) this.reviews.delete(id);
    }
  }

  async clearAll(): Promise<void> {
    this.records.clear();
    this.entries.clear();
    this.reviews.clear();
    this.drafts.clear();
    this.revisions.clear();
  }

  async loadDraft(owner: string, key: string): Promise<JournalDraft | null> { return clone(this.drafts.get(JSON.stringify([owner, key])) ?? null); }
  async saveDraft(owner: string, key: string, draft: JournalDraft): Promise<void> { this.drafts.set(JSON.stringify([owner, key]), clone(draft)); }
  async clearDraft(owner: string, key: string): Promise<void> { this.drafts.delete(JSON.stringify([owner, key])); }
  async listRevisions(owner: string, recordId: string): Promise<readonly JournalRevision[]> {
    return [...this.revisions.values()].filter((value) => value.owner === owner && value.revision.recordId === recordId).map((value) => clone(value.revision));
  }
}

import type { JournalEntry, JournalRecord } from "../domain/journal-record";
import type { JournalPeriodReview, JournalRecordSummary, JournalRepository } from "./journal-repository";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class InMemoryJournalRepository implements JournalRepository {
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

  async updateRecord(ownerAccountId: string, record: JournalRecord): Promise<void> {
    const current = this.records.get(record.id);
    if (current?.ownerAccountId !== ownerAccountId) throw new Error("journal-record-not-found");
    this.records.set(record.id, { ownerAccountId, record: clone(record) });
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
    for (const [entryId, entry] of this.entries) {
      if (entry.recordId === id) this.entries.delete(entryId);
    }
  }

  async createEntry(ownerAccountId: string, entry: JournalEntry): Promise<void> {
    if (this.records.get(entry.recordId)?.ownerAccountId !== ownerAccountId) throw new Error("journal-record-not-found");
    if (this.entries.has(entry.id)) throw new Error("journal-entry-conflict");
    this.entries.set(entry.id, clone(entry));
  }

  async updateEntry(ownerAccountId: string, entry: JournalEntry): Promise<void> {
    if (this.records.get(entry.recordId)?.ownerAccountId !== ownerAccountId || !this.entries.has(entry.id)) throw new Error("journal-entry-not-found");
    this.entries.set(entry.id, clone(entry));
  }

  async loadEntry(ownerAccountId: string, id: string): Promise<JournalEntry | null> {
    const entry = this.entries.get(id);
    return entry !== undefined && this.records.get(entry.recordId)?.ownerAccountId === ownerAccountId ? clone(entry) : null;
  }

  async deleteEntry(ownerAccountId: string, id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (entry !== undefined && this.records.get(entry.recordId)?.ownerAccountId === ownerAccountId) this.entries.delete(id);
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
  }
}

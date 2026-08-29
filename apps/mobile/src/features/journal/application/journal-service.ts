import {
  canEditJournalItem,
  createJournalEntry,
  createJournalRecord,
  type JournalEntry,
  type JournalEntryKind,
  type JournalHighlight,
  type JournalRecord,
  type JournalSource,
  type JournalTopic
} from "../domain/journal-record";
import type { JournalPeriodReview, JournalRecordSummary, JournalRepository } from "../infrastructure/journal-repository";
import { JOURNAL_EDIT_WINDOW_MS } from "../domain/journal-record";

export type JournalServiceErrorCode = "journal-item-locked" | "journal-record-not-found" | "journal-entry-not-found";

export class JournalServiceError extends Error {
  constructor(readonly code: JournalServiceErrorCode) {
    super(code);
    this.name = "JournalServiceError";
  }
}

type Dependencies = Readonly<{ now(): string; createId(): string }>;

export class JournalService {
  constructor(
    private readonly repository: JournalRepository,
    private readonly dependencies: Dependencies,
    private readonly ownerAccountId: string,
  ) {
    if (!ownerAccountId.trim()) throw new Error("journal-owner-required");
  }

  claimLegacyRecords(): Promise<void> {
    return this.repository.claimUnowned(this.ownerAccountId);
  }

  ensureDeletionCleanup(): Promise<boolean> {
    return this.repository.ensureDeletionCleanup(this.ownerAccountId);
  }

  createRecord(input: Readonly<{
    title: string;
    occurredAt: string;
    highlight: JournalHighlight;
    body?: string;
    topics?: readonly JournalTopic[];
    source?: JournalSource;
    cardSnapshot?: JournalRecord["cardSnapshot"];
  }>): Promise<JournalRecord> {
    const record = createJournalRecord({
      id: this.dependencies.createId(),
      createdAt: this.dependencies.now(),
      ...input,
      source: input.source ?? { kind: "freeform" }
    });
    return this.repository.createRecord(this.ownerAccountId, record).then(() => record);
  }

  listRecords(): Promise<readonly JournalRecordSummary[]> {
    return this.repository.listRecords(this.ownerAccountId);
  }

  async loadRecord(id: string): Promise<{ record: JournalRecord; entries: readonly JournalEntry[] } | null> {
    const record = await this.repository.loadRecord(this.ownerAccountId, id);
    if (record === null) return null;
    return { record, entries: await this.repository.listEntries(this.ownerAccountId, id) };
  }

  async updateRecord(id: string, patch: Partial<Pick<JournalRecord, "title" | "occurredAt" | "highlight" | "body" | "topics">>): Promise<JournalRecord> {
    const current = await this.requireRecord(id);
    const now = this.dependencies.now();
    if (!canEditJournalItem(now, current.editableUntil)) throw new JournalServiceError("journal-item-locked");
    const normalized = createJournalRecord({ ...current, ...patch, createdAt: current.createdAt });
    const updated = { ...normalized, editableUntil: current.editableUntil, updatedAt: new Date(now).toISOString() };
    await this.repository.updateRecord(this.ownerAccountId, updated);
    return updated;
  }

  async addEntry(recordId: string, input: Readonly<{
    kind: JournalEntryKind;
    occurredAt: string;
    body: string;
    highlight?: JournalHighlight | null;
  }>): Promise<JournalEntry> {
    await this.requireRecord(recordId);
    const entry = createJournalEntry({ id: this.dependencies.createId(), recordId, createdAt: this.dependencies.now(), ...input });
    await this.repository.createEntry(this.ownerAccountId, entry);
    return entry;
  }

  createCorrectionFromExpiredEdit(recordId: string, input: Readonly<{ occurredAt: string; body: string; highlight?: JournalHighlight | null }>): Promise<JournalEntry> {
    return this.addEntry(recordId, { kind: "correction", ...input });
  }

  async updateEntry(id: string, patch: Partial<Pick<JournalEntry, "kind" | "occurredAt" | "highlight" | "body">>): Promise<JournalEntry> {
    const current = await this.repository.loadEntry(this.ownerAccountId, id);
    if (current === null) throw new JournalServiceError("journal-entry-not-found");
    const now = this.dependencies.now();
    if (!canEditJournalItem(now, current.editableUntil)) throw new JournalServiceError("journal-item-locked");
    const normalized = createJournalEntry({ ...current, ...patch, createdAt: current.createdAt });
    const updated = { ...normalized, editableUntil: current.editableUntil, updatedAt: new Date(now).toISOString() };
    await this.repository.updateEntry(this.ownerAccountId, updated);
    return updated;
  }

  deleteRecord(id: string): Promise<void> { return this.repository.deleteRecord(this.ownerAccountId, id); }
  deleteEntry(id: string): Promise<void> { return this.repository.deleteEntry(this.ownerAccountId, id); }
  loadEntry(id: string): Promise<JournalEntry | null> { return this.repository.loadEntry(this.ownerAccountId, id); }
  clearCurrentAccount(): Promise<void> { return this.repository.clearOwner(this.ownerAccountId); }

  async savePeriodReview(input: Readonly<{
    periodStart: string; periodEnd: string; title: string; body: string; sourceRecordIds: readonly string[];
  }>): Promise<JournalPeriodReview> {
    const sourceRecordIds = [...new Set(input.sourceRecordIds)];
    for (const id of sourceRecordIds) await this.requireRecord(id);
    const createdAt = new Date(this.dependencies.now()).toISOString();
    const review: JournalPeriodReview = {
      id: this.dependencies.createId(), periodStart: new Date(input.periodStart).toISOString(),
      periodEnd: new Date(input.periodEnd).toISOString(), createdAt, updatedAt: createdAt,
      editableUntil: new Date(Date.parse(createdAt) + JOURNAL_EDIT_WINDOW_MS).toISOString(),
      title: input.title.trim(), body: input.body.trim(), sourceRecordIds
    };
    if (!review.title || !review.body) throw new Error("journal-period-review-required");
    await this.repository.savePeriodReview(this.ownerAccountId, review);
    return review;
  }

  listPeriodReviews(): Promise<readonly JournalPeriodReview[]> { return this.repository.listPeriodReviews(this.ownerAccountId); }

  private async requireRecord(id: string): Promise<JournalRecord> {
    const record = await this.repository.loadRecord(this.ownerAccountId, id);
    if (record === null) throw new JournalServiceError("journal-record-not-found");
    return record;
  }
}

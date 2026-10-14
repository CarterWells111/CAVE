import type { JournalService } from "../journal/application/journal-service";
import { localJournalToday, journalDateFromDate, parseJournalDate } from "../journal/domain/journal-date";
import { canEditJournalItem, type JournalRecord, type JournalEntry } from "../journal/domain/journal-record";
import type { JournalRecordSummary } from "../journal/infrastructure/journal-repository";

export const JOURNAL_DRAFT_PROTOCOL = "cave-journal-draft-v1";
export type AssistantJournalAccess = Readonly<{ status: string; accountId?: string; service?: JournalService }>;
export type JournalDraftFields = Readonly<{ title: string; occurredAt: string; body: string }>;
export type AssistantJournalDraft = JournalDraftFields & Readonly<{
  mode: "new" | "edit" | "review";
  requestId: string;
  original?: Readonly<{ record: JournalRecord; entries: readonly JournalEntry[] }>;
}>;
export type AssistantJournalState = Readonly<{
  choices: readonly JournalRecordSummary[];
  selectedIds: readonly string[];
  draft: AssistantJournalDraft | null;
  busy: boolean;
  error: string | null;
}>;

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
let sequence = 0;
function validFields(value: unknown): JournalDraftFields {
  if (!value || typeof value !== "object") throw new Error("journal-draft-invalid");
  const item = value as Record<string, unknown>;
  if (typeof item.title !== "string" || !item.title.trim() || item.title.length > 200
    || typeof item.body !== "string" || !item.body.trim() || item.body.length > 12000
    || typeof item.occurredAt !== "string") throw new Error("journal-draft-invalid");
  parseJournalDate(item.occurredAt);
  return { title: item.title.trim(), body: item.body.trim(), occurredAt: item.occurredAt };
}

/** Local only. Nothing in selection, generation or preview writes to JournalService. */
export class AssistantJournalController {
  private state: AssistantJournalState = { choices: [], selectedIds: [], draft: null, busy: false, error: null };
  private listeners = new Set<() => void>();
  private epoch = 0;
  private disposed = false;
  private readonly accountId: string | undefined;
  private readonly service: JournalService | undefined;
  constructor(private readonly getAccess: () => AssistantJournalAccess, private readonly now: () => string = () => new Date().toISOString()) {
    const access = getAccess();
    this.accountId = access.accountId;
    this.service = access.service;
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AssistantJournalState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener());
  }
  private active(epoch = this.epoch): boolean {
    const access = this.getAccess();
    return !this.disposed && epoch === this.epoch && !!this.accountId && access.status === "ready"
      && access.accountId === this.accountId && !!this.service && access.service === this.service;
  }
  private requireAccess(epoch = this.epoch): JournalService {
    if (!this.active(epoch)) throw new Error("journal-session-changed");
    return this.service!;
  }
  private async run<T>(operation: (service: JournalService, epoch: number) => Promise<T>): Promise<T> {
    if (this.state.busy) throw new Error("journal-operation-pending");
    const epoch = this.epoch;
    const service = this.requireAccess(epoch);
    this.publish({ busy: true, error: null });
    try {
      const result = await operation(service, epoch);
      this.requireAccess(epoch);
      return result;
    } catch (error) {
      if (this.active(epoch)) this.publish({ error: error instanceof Error ? error.message : "journal-request-failed" });
      throw error;
    } finally {
      if (epoch === this.epoch) this.publish({ busy: false });
    }
  }
  refreshChoices() {
    return this.run(async (service, epoch) => {
      const choices = await service.listRecords();
      this.requireAccess(epoch);
      this.publish({ choices: copy(choices), selectedIds: this.state.selectedIds.filter(id => choices.some(item => item.id === id)) });
    });
  }
  toggleSelection(id: string) {
    this.requireAccess();
    if (this.state.busy) throw new Error("journal-operation-pending");
    if (!this.state.choices.some(item => item.id === id)) throw new Error("journal-record-not-found");
    const selectedIds = this.state.selectedIds.includes(id) ? [] : [id];
    this.publish({ selectedIds, draft: null, error: null });
  }
  private async payload(service: JournalService, epoch: number) {
    const records: { id: string; text: string }[] = [];
    let length = 0;
    for (const id of this.state.selectedIds) {
      const loaded = await service.loadRecord(id);
      this.requireAccess(epoch);
      if (!loaded) throw new Error("journal-record-not-found");
      const { record, entries } = loaded;
      const text = JSON.stringify({ title: record.title, occurredAt: record.occurredAt, highlight: record.highlight, topics: record.topics,
        body: record.body, entries: entries.map(({ kind, occurredAt, body, highlight }) => ({ kind, occurredAt, body, highlight })) });
      // Reject, never silently cut original text or lose the meaning of additions.
      length += text.length;
      if (text.length > 4000 || length > 12000) throw new Error("journal-context-too-large");
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/u.test(id)) throw new Error("journal-context-invalid-id");
      records.push({ id, text });
    }
    return records;
  }
  getRecordPayload() { return this.run((service, epoch) => this.payload(service, epoch)); }
  beginNew(occurredAt = localJournalToday()) {
    this.requireAccess();
    if (this.state.busy) throw new Error("journal-operation-pending");
    parseJournalDate(occurredAt);
    this.publish({ selectedIds: [], draft: { mode: "new", requestId: `journal-${Date.now()}-${++sequence}`, title: "", body: "", occurredAt }, error: null });
  }
  beginEdit(id: string) {
    return this.run(async (service, epoch) => {
      if (!this.state.selectedIds.includes(id)) throw new Error("journal-record-not-selected");
      const original = await service.loadRecord(id);
      this.requireAccess(epoch);
      if (!original) throw new Error("journal-record-not-found");
      if (!canEditJournalItem(this.now(), original.record.editableUntil)) throw new Error("journal-item-locked");
      const { title, occurredAt, body } = original.record;
      this.publish({ draft: { mode: "edit", requestId: `journal-${Date.now()}-${++sequence}`, title, occurredAt, body, original: copy(original) } });
    });
  }
  beginReview(id: string) {
    return this.run(async (service, epoch) => {
      if (!this.state.selectedIds.includes(id)) throw new Error("journal-record-not-selected");
      const original = await service.loadRecord(id);
      this.requireAccess(epoch);
      if (!original) throw new Error("journal-record-not-found");
      this.publish({ draft: { mode: "review", requestId: `journal-${Date.now()}-${++sequence}`,
        title: original.record.title, occurredAt: journalDateFromDate(new Date(this.now())), body: "", original: copy(original) }, error: null });
    });
  }
  editDraft(patch: Partial<JournalDraftFields>) {
    this.requireAccess();
    if (this.state.busy) throw new Error("journal-operation-pending");
    const draft = this.state.draft;
    if (!draft) throw new Error("journal-draft-required");
    // Permit incomplete input while typing; validate all fields on confirmation.
    this.publish({ draft: { ...draft, title: draft.mode === "review" ? draft.title : patch.title ?? draft.title, body: patch.body ?? draft.body, occurredAt: draft.mode === "review" ? draft.occurredAt : patch.occurredAt ?? draft.occurredAt }, error: null });
  }
  generationRequest(instruction: string) {
    return this.run(async (service, epoch) => {
      const draft = this.state.draft;
      if (!draft) throw new Error("journal-draft-required");
      if (draft.mode !== "new" && !this.state.selectedIds.includes(draft.original!.record.id)) throw new Error("journal-record-not-selected");
      const question = `请${draft.mode === "edit" ? "优化原手记正文的表达，保留事实、标题、日期，不合并或改写补充记录" : draft.mode === "review" ? "回顾原手记和补充，整理新的理解，保留原标题和本次日期，确认后只追加后续、不改原文" : "根据用户叙述生成新手记，不编造事实"}。仅返回一个JSON对象，不加Markdown或解释，字段必须且只能为protocol、requestId、title、occurredAt、body。protocol="${JOURNAL_DRAFT_PROTOCOL}"，requestId="${draft.requestId}"，occurredAt="${draft.occurredAt}"。${draft.mode !== "new" ? `title=${JSON.stringify(draft.original!.record.title)}。` : "title简短。"}正文不超过1200字。这只是待用户确认的草稿，禁止声称已经保存。用户要求：${instruction.trim()}`;
      if (!instruction.trim() || question.length > 1000) throw new Error("journal-instruction-invalid");
      const records = await this.payload(service, epoch);
      return { mode: "chat" as const, consent: true as const, ...(records.length ? { contextConsent: true } : {}), records, question };
    });
  }
  acceptGeneration(text: string) {
    this.requireAccess();
    if (this.state.busy) throw new Error("journal-operation-pending");
    const draft = this.state.draft;
    if (!draft) throw new Error("journal-draft-required");
    if (text.length > 2000) throw new Error("journal-draft-invalid");
    let item: Record<string, unknown>;
    try { item = JSON.parse(text) as Record<string, unknown>; } catch { throw new Error("journal-draft-invalid"); }
    if (!item || typeof item !== "object" || Array.isArray(item)
      || Object.keys(item).sort().join(",") !== "body,occurredAt,protocol,requestId,title"
      || item.protocol !== JOURNAL_DRAFT_PROTOCOL || item.requestId !== draft.requestId) throw new Error("journal-draft-invalid");
    const fields = validFields(item);
    if (fields.body.length > 1200 || fields.occurredAt !== draft.occurredAt) throw new Error("journal-draft-invalid");
    if (draft.mode !== "new" && fields.title !== draft.original!.record.title) throw new Error("journal-draft-invalid");
    if (draft.mode === "edit" && fields.occurredAt !== draft.original!.record.occurredAt) throw new Error("journal-draft-invalid");
    this.publish({ draft: { ...draft, ...fields }, error: null });
  }
  confirmSave() {
    return this.run(async (service, epoch) => {
      const draft = this.state.draft;
      if (!draft) throw new Error("journal-draft-required");
      const fields = validFields(draft);
      const canCommit = () => this.active(epoch);
      let saved: JournalRecord;
      if (draft.mode === "review") {
        if (fields.title !== draft.original!.record.title) throw new Error("journal-draft-invalid");
        await service.addEntry(draft.original!.record.id, { kind: "insight", occurredAt: fields.occurredAt, body: fields.body },
          { expected: draft.original!.record, expectedEntries: draft.original!.entries, canCommit });
        saved = draft.original!.record;
      } else {
        saved = draft.mode === "new"
          ? await service.createRecord(fields, { canCommit })
          : await service.updateRecord(draft.original!.record.id, fields, { expected: draft.original!.record, canCommit });
      }
      this.requireAccess(epoch);
      this.publish({ draft: null });
      return saved;
    });
  }
  cancelDraft() {
    this.epoch += 1;
    this.publish({ draft: null, busy: false, error: null });
  }
  clear() {
    this.epoch += 1;
    this.publish({ choices: [], selectedIds: [], draft: null, busy: false, error: null });
  }
  activate() { this.disposed = false; }
  dispose() { this.disposed = true; this.epoch += 1; }
}

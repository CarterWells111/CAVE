import { JournalService } from "../journal/application/journal-service";
import { InMemoryJournalRepository } from "../journal/infrastructure/in-memory-journal-repository";
import { AssistantJournalController, JOURNAL_DRAFT_PROTOCOL, type AssistantJournalAccess } from "./assistant-journal";

const initialNow = "2026-10-14T10:00:00.000Z";
function setup() {
  let now = initialNow;
  let counter = 0;
  const repository = new InMemoryJournalRepository();
  const dependencies = { now: () => now, createId: () => `test-${++counter}` };
  const service = new JournalService(repository, dependencies, "synthetic-a");
  const other = new JournalService(repository, dependencies, "synthetic-b");
  let access: AssistantJournalAccess = { status: "ready", accountId: "synthetic-a", service };
  const controller = new AssistantJournalController(() => access, () => now);
  const create = (body = "合成原文", title = "合成标题") => service.createRecord({ occurredAt: "2026-10-13", title, body });
  return { repository, service, other, controller, create, setAccess: (value: AssistantJournalAccess) => { access = value; }, setNow: (value: string) => { now = value; } };
}
function generated(controller: AssistantJournalController, fields = {}) {
  const draft = controller.getSnapshot().draft!;
  return JSON.stringify({ protocol: JOURNAL_DRAFT_PROTOCOL, requestId: draft.requestId, title: draft.title || "新标题", occurredAt: draft.occurredAt, body: "合成优化后的正文", ...fields });
}
async function select(context: ReturnType<typeof setup>, id: string) {
  await context.controller.refreshChoices();
  context.controller.toggleSelection(id);
}

test("selects only one current-account record and replacing or unchecking it clears the draft", async () => {
  const context = setup();
  const own = await Promise.all(Array.from({ length: 3 }, () => context.create()));
  const foreign = await context.other.createRecord({ occurredAt: "2026-10-14", body: "其他合成账号" });
  await context.controller.refreshChoices();
  expect(() => context.controller.toggleSelection(foreign.id)).toThrow("journal-record-not-found");
  context.controller.toggleSelection(own[0]!.id);
  await context.controller.beginEdit(own[0]!.id);
  context.controller.toggleSelection(own[1]!.id);
  expect(context.controller.getSnapshot()).toMatchObject({ selectedIds: [own[1]!.id], draft: null });
  await context.controller.beginReview(own[1]!.id);
  context.controller.toggleSelection(own[2]!.id);
  expect(context.controller.getSnapshot()).toMatchObject({ selectedIds: [own[2]!.id], draft: null });
  context.controller.beginNew();
  expect(context.controller.getSnapshot()).toMatchObject({ selectedIds: [], draft: { mode: "new" } });
  context.controller.toggleSelection(own[2]!.id);
  expect(context.controller.getSnapshot()).toMatchObject({ selectedIds: [own[2]!.id], draft: null });
  context.controller.toggleSelection(own[2]!.id);
  expect(context.controller.getSnapshot()).toMatchObject({ selectedIds: [], draft: null });
});

test("starting a new journal removes the previous source from generation requests", async () => {
  const context = setup();
  const original = await context.create("此前选择的合成正文");
  await context.service.addEntry(original.id, { kind: "insight", occurredAt: "2026-10-14", body: "此前选择的合成补充" });
  await select(context, original.id);
  await context.controller.beginEdit(original.id);
  context.controller.beginNew("2026-10-14");

  const request = await context.controller.generationRequest("我今天去了另一个地方，请写成一篇新手记");
  expect(context.controller.getSnapshot()).toMatchObject({ selectedIds: [], draft: { mode: "new", title: "", body: "" } });
  expect(request.records).toEqual([]);
  expect(request).not.toHaveProperty("contextConsent");
  expect(JSON.stringify(request)).not.toContain("此前选择的合成");
  expect((await context.service.loadRecord(original.id))?.record.body).toBe(original.body);
  expect((await context.service.loadRecord(original.id))?.entries).toHaveLength(1);
});

test("bounded payload preserves title/date/original and distinct supplementary semantics without private source", async () => {
  const context = setup();
  const record = await context.service.createRecord({ title: "原题", occurredAt: "2026-10-13", body: "原文", source: { kind: "journey", journeyId: "private-source" }, cardSnapshot: { cardId: "private-card", capturedAt: initialNow, sections: [] } });
  await context.service.addEntry(record.id, { kind: "correction", occurredAt: "2026-10-14", body: "补充修正" });
  await select(context, record.id);
  const payload = await context.controller.getRecordPayload();
  expect(JSON.parse(payload[0]!.text)).toMatchObject({ title: "原题", occurredAt: "2026-10-13", body: "原文", entries: [{ kind: "correction", occurredAt: "2026-10-14", body: "补充修正" }] });
  expect(JSON.stringify(payload)).not.toMatch(/private-source|private-card/);
  const large = await context.create("字".repeat(4000));
  await context.controller.refreshChoices();
  context.controller.toggleSelection(large.id);
  await expect(context.controller.getRecordPayload()).rejects.toThrow("journal-context-too-large");
  expect((await context.service.loadRecord(large.id))!.record.body).toHaveLength(4000);
});

test("reselecting attachments removes the old edit draft when its source is unchecked", async () => {
  const context = setup();
  const record = await context.create();
  await select(context, record.id);
  await context.controller.beginEdit(record.id);
  context.controller.toggleSelection(record.id);
  expect(context.controller.getSnapshot()).toMatchObject({ selectedIds: [], draft: null });
  expect(await context.controller.getRecordPayload()).toEqual([]);
  expect((await context.service.loadRecord(record.id))?.record.body).toBe(record.body);
});

test("new generation and editable preview do not write; explicit confirmation creates exactly one record", async () => {
  const context = setup();
  const create = jest.spyOn(context.service, "createRecord");
  context.controller.beginNew("2026-10-13");
  const request = await context.controller.generationRequest("我今天去散步了");
  expect(request).toMatchObject({ mode: "chat", consent: true, records: [] });
  expect(request).not.toHaveProperty("contextConsent");
  expect(request.question).toContain(JOURNAL_DRAFT_PROTOCOL);
  context.controller.acceptGeneration(generated(context.controller));
  context.controller.editDraft({ body: "我确认的正文" });
  expect(create).not.toHaveBeenCalled();
  expect(await context.service.listRecords()).toEqual([]);
  const saved = await context.controller.confirmSave();
  expect(saved).toMatchObject({ title: "新标题", occurredAt: "2026-10-13", body: "我确认的正文", source: { kind: "freeform" } });
  expect(create).toHaveBeenCalledTimes(1);
  expect(context.controller.getSnapshot().draft).toBeNull();
  await expect(context.controller.confirmSave()).rejects.toThrow("journal-draft-required");
});

test("edit preview preserves original and additions; confirmation revises only the record", async () => {
  const context = setup();
  const original = await context.create();
  const entry = await context.service.addEntry(original.id, { kind: "feeling-change", body: "后来的感受", occurredAt: "2026-10-14" });
  await select(context, original.id);
  await context.controller.beginEdit(original.id);
  const request = await context.controller.generationRequest("表达自然一些");
  expect(request.contextConsent).toBe(true);
  context.controller.acceptGeneration(generated(context.controller));
  expect((await context.service.loadRecord(original.id))!.record).toEqual(original);
  expect(context.controller.getSnapshot().draft!.original!.record).toEqual(original);
  await context.controller.confirmSave();
  const loaded = (await context.service.loadRecord(original.id))!;
  expect(loaded.record).toMatchObject({ title: original.title, occurredAt: original.occurredAt, body: "合成优化后的正文", highlight: original.highlight, topics: original.topics, source: original.source });
  expect(loaded.entries).toEqual([entry]);
  expect((await context.service.listRevisions(original.id))[0]!.snapshot).toEqual(original);
});

test("cancel and clearing a conversation do not write and invalidate late generated results", async () => {
  const context = setup();
  const original = await context.create();
  await select(context, original.id);
  await context.controller.beginEdit(original.id);
  const late = generated(context.controller);
  context.controller.cancelDraft();
  expect(() => context.controller.acceptGeneration(late)).toThrow("journal-draft-required");
  context.controller.beginNew();
  expect(() => context.controller.acceptGeneration(late)).toThrow("journal-draft-invalid");
  context.controller.clear();
  expect(context.controller.getSnapshot()).toMatchObject({ choices: [], selectedIds: [], draft: null });
  expect((await context.service.loadRecord(original.id))!.record).toEqual(original);
  expect(await context.service.listRevisions(original.id)).toEqual([]);
});

test.each([
  "ordinary prose", "```json\n{}\n```", "null", "[]", "{}",
])("rejects ambiguous or malformed AI output %s without replacing preview", text => {
  const { controller } = setup();
  controller.beginNew();
  const before = controller.getSnapshot().draft;
  expect(() => controller.acceptGeneration(text)).toThrow("journal-draft-invalid");
  expect(controller.getSnapshot().draft).toBe(before);
});

test("protocol rejects extra fields, wrong request, invalid date, and AI title/date changes during edits", async () => {
  const context = setup();
  const original = await context.create();
  await select(context, original.id);
  await context.controller.beginEdit(original.id);
  for (const fields of [{ extra: true }, { requestId: "old" }, { occurredAt: "2026-02-30" }, { title: "擅自改题" }, { occurredAt: "2026-10-14" }, { body: "" }]) {
    expect(() => context.controller.acceptGeneration(generated(context.controller, fields))).toThrow();
  }
  expect(context.controller.getSnapshot().draft!.body).toBe(original.body);
});

test("failed persistence keeps complete draft for retry", async () => {
  const context = setup();
  context.controller.beginNew();
  context.controller.acceptGeneration(generated(context.controller));
  const draft = context.controller.getSnapshot().draft;
  const create = jest.spyOn(context.repository, "createRecord").mockRejectedValueOnce(new Error("synthetic-storage-failure"));
  await expect(context.controller.confirmSave()).rejects.toThrow("synthetic-storage-failure");
  expect(context.controller.getSnapshot()).toMatchObject({ draft, busy: false, error: "synthetic-storage-failure" });
  await context.controller.confirmSave();
  expect(create).toHaveBeenCalledTimes(2);
  expect(await context.service.listRecords()).toHaveLength(1);
});

test("deleted and locked records cannot be edited/saved; draft survives save failure", async () => {
  const context = setup();
  const original = await context.create();
  await select(context, original.id);
  await context.controller.beginEdit(original.id);
  context.setNow("2026-10-15T10:00:00.000Z");
  await expect(context.controller.confirmSave()).rejects.toThrow("journal-item-locked");
  expect(context.controller.getSnapshot().draft).not.toBeNull();
  await expect(context.controller.beginEdit(original.id)).rejects.toThrow("journal-item-locked");
  await context.service.deleteRecord(original.id);
  await expect(context.controller.getRecordPayload()).rejects.toThrow("journal-record-not-found");
  await expect(context.controller.confirmSave()).rejects.toThrow("journal-record-not-found");
  expect(await context.service.listRecords()).toEqual([]);
});

test("same-timestamp concurrent edits are rejected; latest prose and additions survive", async () => {
  const context = setup();
  const original = await context.create();
  await select(context, original.id);
  await context.controller.beginEdit(original.id);
  context.controller.acceptGeneration(generated(context.controller));
  const latest = await context.service.updateRecord(original.id, { body: "另一个编辑器的文字" });
  const entry = await context.service.addEntry(original.id, { kind: "insight", occurredAt: "2026-10-14", body: "并发补充" });
  expect(latest.updatedAt).toBe(original.updatedAt);
  await expect(context.controller.confirmSave()).rejects.toThrow("journal-record-conflict");
  expect((await context.service.loadRecord(original.id))!).toEqual({ record: latest, entries: [entry] });
  expect(context.controller.getSnapshot().draft!.body).toBe("合成优化后的正文");
});

test("repository check catches a change between service read and actual commit", async () => {
  const context = setup();
  const original = await context.create();
  await select(context, original.id);
  await context.controller.beginEdit(original.id);
  const update = context.repository.updateRecord.bind(context.repository);
  jest.spyOn(context.repository, "updateRecord").mockImplementationOnce(async (owner, record, revision, guard) => {
    await update(owner, { ...original, body: "事务前的新修改" });
    return update(owner, record, revision, guard);
  });
  await expect(context.controller.confirmSave()).rejects.toThrow("journal-record-conflict");
  expect((await context.service.loadRecord(original.id))!.record.body).toBe("事务前的新修改");
});

test.each(["locked", "loading", "error"])("unavailable status %s blocks all access", status => {
  const context = setup();
  context.setAccess({ status });
  expect(() => context.controller.beginNew()).toThrow("journal-session-changed");
  expect(() => context.controller.toggleSelection("any")).toThrow("journal-session-changed");
});

test("account switch discards late selection reads and refuses old draft confirmation", async () => {
  const context = setup();
  context.controller.beginNew();
  context.controller.acceptGeneration(generated(context.controller));
  let resolve!: (value: Awaited<ReturnType<JournalService["listRecords"]>>) => void;
  jest.spyOn(context.service, "listRecords").mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const loading = context.controller.refreshChoices();
  context.setAccess({ status: "ready", accountId: "synthetic-b", service: context.other });
  resolve([{ id: "late", title: "迟到合成标题", occurredAt: "2026-10-14", createdAt: initialNow, topics: [], highlight: { kind: "impression", text: "合成" } }]);
  await expect(loading).rejects.toThrow("journal-session-changed");
  expect(context.controller.getSnapshot().choices).toEqual([]);
  await expect(context.controller.confirmSave()).rejects.toThrow("journal-session-changed");
  expect(await context.other.listRecords()).toEqual([]);
});

test.each(["new", "edit"] as const)("account switch at %s commit prevents late writes", async mode => {
  const context = setup();
  const original = await context.create();
  if (mode === "edit") { await select(context, original.id); await context.controller.beginEdit(original.id); }
  else context.controller.beginNew();
  context.controller.acceptGeneration(generated(context.controller));
  const switchAccount = () => context.setAccess({ status: "ready", accountId: "synthetic-b", service: context.other });
  if (mode === "new") {
    const create = context.repository.createRecord.bind(context.repository);
    jest.spyOn(context.repository, "createRecord").mockImplementationOnce(async (...args) => { switchAccount(); return create(...args); });
  } else {
    const update = context.repository.updateRecord.bind(context.repository);
    jest.spyOn(context.repository, "updateRecord").mockImplementationOnce(async (...args) => { switchAccount(); return update(...args); });
  }
  await expect(context.controller.confirmSave()).rejects.toThrow("journal-session-changed");
  expect((await context.service.loadRecord(original.id))!.record).toEqual(original);
  expect(await context.service.listRecords()).toHaveLength(1);
  expect(await context.other.listRecords()).toEqual([]);
});

test("double confirmation cannot submit two writes while one is pending", async () => {
  const context = setup();
  context.controller.beginNew();
  context.controller.acceptGeneration(generated(context.controller));
  const create = context.repository.createRecord.bind(context.repository);
  let resolve!: () => void;
  jest.spyOn(context.repository, "createRecord").mockImplementationOnce(async (...args) => {
    await new Promise<void>(done => { resolve = done; });
    return create(...args);
  });
  const pending = context.controller.confirmSave();
  await expect(context.controller.confirmSave()).rejects.toThrow("journal-operation-pending");
  resolve();
  await pending;
  expect(await context.service.listRecords()).toHaveLength(1);
});

test("a locked original can be reviewed locally and only confirmation appends an insight", async () => {
  const context = setup();
  const original = await context.create();
  const existing = await context.service.addEntry(original.id, { kind: "event-change", occurredAt: "2026-10-14", body: "已有补充" });
  context.setNow("2026-10-17T10:00:00.000Z");
  await select(context, original.id);
  await expect(context.controller.beginEdit(original.id)).rejects.toThrow("journal-item-locked");
  await context.controller.beginReview(original.id);
  expect(context.controller.getSnapshot().draft).toMatchObject({ mode: "review", title: original.title, occurredAt: "2026-10-17", body: "", original: { record: original, entries: [existing] } });
  const create = jest.spyOn(context.service, "createRecord");
  const update = jest.spyOn(context.service, "updateRecord");
  const append = jest.spyOn(context.service, "addEntry");
  const request = await context.controller.generationRequest("帮我回顾后来明白了什么");
  expect(request.records).toHaveLength(1);
  expect(request.records[0]?.text).toContain("已有补充");
  context.controller.acceptGeneration(generated(context.controller, { body: "回顾后新的理解" }));
  context.controller.editDraft({ title: "不得改原标题", occurredAt: "2020-01-01", body: "确认后的新理解" });
  expect(context.controller.getSnapshot().draft).toMatchObject({ title: original.title, occurredAt: "2026-10-17" });
  expect(append).not.toHaveBeenCalled();
  expect((await context.service.loadRecord(original.id))!).toEqual({ record: original, entries: [existing] });
  await expect(context.controller.confirmSave()).resolves.toEqual(original);
  expect(create).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
  expect(append).toHaveBeenCalledTimes(1);
  expect((await context.service.loadRecord(original.id))!).toMatchObject({ record: original, entries: [existing, { kind: "insight", occurredAt: "2026-10-17", body: "确认后的新理解" }] });
  expect(await context.service.listRecords()).toHaveLength(1);
  expect(await context.service.listRevisions(original.id)).toEqual([]);
});

test("review generation keeps the original title and today's date and requires selection", async () => {
  const context = setup();
  const original = await context.create();
  await expect(context.controller.beginReview(original.id)).rejects.toThrow("journal-record-not-selected");
  await select(context, original.id); await context.controller.beginReview(original.id);
  for (const fields of [{ title: "模型改了题目" }, { occurredAt: "2026-10-13" }]) {
    expect(() => context.controller.acceptGeneration(generated(context.controller, fields))).toThrow("journal-draft-invalid");
  }
  expect(context.controller.getSnapshot().draft?.body).toBe("");
});

test.each(["record-change", "entry-add", "entry-edit", "delete", "owner-clear"] as const)("review confirmation refuses stale read snapshots after %s", async change => {
  const context = setup();
  const original = await context.create();
  const entry = await context.service.addEntry(original.id, { kind: "event-change", occurredAt: "2026-10-14", body: "已有补充" });
  await select(context, original.id); await context.controller.beginReview(original.id);
  context.controller.acceptGeneration(generated(context.controller));
  if (change === "record-change") await context.service.updateRecord(original.id, { body: "同毫秒的新原文" });
  if (change === "entry-add") await context.service.addEntry(original.id, { kind: "insight", occurredAt: "2026-10-14", body: "后来新补充" });
  if (change === "entry-edit") await context.service.updateEntry(entry.id, { body: "同毫秒的新补充" });
  if (change === "delete") await context.service.deleteRecord(original.id);
  if (change === "owner-clear") await context.service.clearCurrentAccount();
  const before = await context.service.loadRecord(original.id);
  await expect(context.controller.confirmSave()).rejects.toThrow(change === "delete" || change === "owner-clear" ? "journal-record-not-found" : "journal-record-conflict");
  expect(await context.service.loadRecord(original.id)).toEqual(before);
  expect(context.controller.getSnapshot().draft).not.toBeNull();
});

test.each(["account-change", "conversation-clear", "record-change", "delete"] as const)("the repository blocks a review changed at the final commit: %s", async change => {
  const context = setup();
  const original = await context.create();
  await select(context, original.id); await context.controller.beginReview(original.id);
  context.controller.acceptGeneration(generated(context.controller));
  const append = context.repository.createEntry.bind(context.repository);
  jest.spyOn(context.repository, "createEntry").mockImplementationOnce(async (...args) => {
    if (change === "account-change") context.setAccess({ status: "ready", accountId: "synthetic-b", service: context.other });
    if (change === "conversation-clear") context.controller.clear();
    if (change === "record-change") await context.repository.updateRecord("synthetic-a", { ...original, body: "提交前修改" });
    if (change === "delete") await context.service.deleteRecord(original.id);
    return append(...args);
  });
  await expect(context.controller.confirmSave()).rejects.toThrow(change === "record-change" ? "journal-record-conflict" : change === "delete" ? "journal-record-not-found" : "journal-session-changed");
  expect((await context.service.loadRecord(original.id))?.entries ?? []).toEqual([]);
  expect(await context.other.listRecords()).toEqual([]);
});

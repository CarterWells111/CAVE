import { JournalService } from "../journal/application/journal-service";
import { InMemoryJournalRepository } from "../journal/infrastructure/in-memory-journal-repository";
import { AssistantJournalController, JOURNAL_DRAFT_PROTOCOL, type AssistantJournalAccess, type JournalPeriodReviewContext } from "./assistant-journal";

function setup() {
  let sequence = 0;
  const repository = new InMemoryJournalRepository();
  const dependencies = { now: () => "2026-10-18T12:00:00.000Z", createId: () => `period-source-${++sequence}` };
  const service = new JournalService(repository, dependencies, "period-owner");
  const other = new JournalService(repository, dependencies, "other-owner");
  let access: AssistantJournalAccess = { status: "ready", accountId: "period-owner", service };
  const controller = new AssistantJournalController(() => access, dependencies.now);
  return { repository, service, other, controller, setAccess: (next: AssistantJournalAccess) => { access = next; },
    create: (occurredAt = "2026-10-10") => service.createRecord({ occurredAt, body: "合成阶段原文" }) };
}
const context = (sourceRecordIds: readonly string[] = []): JournalPeriodReviewContext => ({
  startDate: "2026-10-01", endDate: "2026-10-14", title: "我的阶段回顾", body: "已经写下的小结", sourceRecordIds,
});
const generation = (controller: AssistantJournalController) => {
  const draft = controller.getSnapshot().draft!;
  return JSON.stringify({ protocol: JOURNAL_DRAFT_PROTOCOL, requestId: draft.requestId, title: draft.title, occurredAt: draft.occurredAt, body: "我想继续保留这段经验。" });
};

test("period context keeps multiple sources and saves only a confirmed period review", async () => {
  const item = setup(); const records = await Promise.all([item.create(), item.create()]);
  const sourceRecordIds = records.map(record => record.id);
  const save = jest.spyOn(item.service, "savePeriodReview");
  const append = jest.spyOn(item.service, "addEntry"); const create = jest.spyOn(item.service, "createRecord");
  await item.controller.beginPeriodReview(context(sourceRecordIds));
  expect(item.controller.getSnapshot()).toMatchObject({ selectedIds: sourceRecordIds, draft: { mode: "period-review", title: context().title, body: context().body, occurredAt: "2026-10-14", period: { startDate: "2026-10-01", endDate: "2026-10-14" } } });
  expect(item.controller.getSnapshot().draft?.requestId).toMatch(/^period-review-/);
  item.controller.acceptGeneration(generation(item.controller));
  item.controller.editDraft({ title: "我确认的阶段小结", body: "我确认后的经验。", occurredAt: "2020-01-01" });
  expect(save).not.toHaveBeenCalled();
  const saved = await item.controller.confirmSave();
  expect(saved).toMatchObject({ title: "我确认的阶段小结", body: "我确认后的经验。", sourceRecordIds, periodStart: "2026-10-01T00:00:00.000Z", periodEnd: "2026-10-14T00:00:00.000Z" });
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ sourceRecordIds }), expect.objectContaining({ canCommit: expect.any(Function) }));
  expect(append).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled();
  expect(await item.service.listRecords()).toHaveLength(2);
  expect(await item.service.listPeriodReviews()).toHaveLength(1);
  expect(item.controller.getSnapshot().draft).toBeNull();
});

test("empty period entry supports multiple choices, rejects extras and regenerates identity without losing local text", async () => {
  const item = setup(); const records = await Promise.all(Array.from({ length: 9 }, () => item.create()));
  const outside = await item.create("2026-09-30");
  await item.controller.beginPeriodReview(context());
  await expect(item.controller.getRecordPayload()).rejects.toThrow("journal-record-not-selected");
  const originalId = item.controller.getSnapshot().draft?.requestId;
  for (const record of records.slice(0, 8)) item.controller.toggleSelection(record.id);
  expect(item.controller.getSnapshot().selectedIds).toHaveLength(8);
  expect(item.controller.getSnapshot().draft?.requestId).not.toBe(originalId);
  expect(item.controller.getSnapshot().draft?.body).toBe(context().body);
  expect(() => item.controller.toggleSelection(records[8]!.id)).toThrow("journal-selection-limit");
  expect(() => item.controller.toggleSelection(outside.id)).toThrow("journal-record-not-found");
  item.controller.toggleSelection(records[0]!.id);
  expect(item.controller.getSnapshot().selectedIds).toHaveLength(7);
  item.controller.setPeriodDates("2026-09-01", "2026-09-30");
  expect(item.controller.getSnapshot()).toMatchObject({ selectedIds: [], draft: { body: context().body, occurredAt: "2026-09-30", period: { startDate: "2026-09-01", endDate: "2026-09-30" } } });
  item.controller.toggleSelection(outside.id);
  expect(item.controller.getSnapshot().selectedIds).toEqual([outside.id]);
});

test("period payload includes only selected records and additions inside the selected dates", async () => {
  const item = setup(); const record = await item.create();
  for (const occurredAt of ["2026-09-30", "2026-10-01", "2026-10-14", "2026-10-15"]) await item.service.addEntry(record.id, { kind: "insight", occurredAt, body: `合成补充${occurredAt}` });
  await item.controller.beginPeriodReview(context([record.id]));
  const payload = await item.controller.getRecordPayload();
  expect(JSON.parse(payload[0]!.text).entries.map((entry: { occurredAt: string }) => entry.occurredAt)).toEqual(["2026-10-01", "2026-10-14"]);
  const oldGeneration = generation(item.controller);
  item.controller.toggleSelection(record.id);
  expect(() => item.controller.acceptGeneration(oldGeneration)).toThrow("journal-draft-invalid");
});

test.each(["account", "conversation"] as const)("period confirmation blocks a late %s change before persistence", async reason => {
  const item = setup(); const record = await item.create();
  await item.controller.beginPeriodReview(context([record.id]));
  const save = item.repository.savePeriodReview.bind(item.repository);
  jest.spyOn(item.repository, "savePeriodReview").mockImplementationOnce(async (...args) => {
    if (reason === "account") item.setAccess({ status: "ready", accountId: "other-owner", service: item.other });
    else item.controller.clear();
    return save(...args);
  });
  await expect(item.controller.confirmSave()).rejects.toThrow("journal-session-changed");
  expect(await item.service.listPeriodReviews()).toEqual([]);
  expect(await item.other.listPeriodReviews()).toEqual([]);
});

test("period context remains available when loading fails or a previously selected source disappears", async () => {
  const item = setup(); const record = await item.create();
  jest.spyOn(item.service, "listRecords").mockRejectedValueOnce(new Error("synthetic-storage-failure"));
  await expect(item.controller.beginPeriodReview(context([record.id]))).rejects.toThrow("synthetic-storage-failure");
  expect(item.controller.getSnapshot()).toMatchObject({ selectedIds: [], draft: { mode: "period-review", title: context().title, body: context().body, period: { startDate: context().startDate, endDate: context().endDate } } });
  await item.controller.refreshChoices();
  item.controller.toggleSelection(record.id);
  await item.service.deleteRecord(record.id);
  await item.controller.beginPeriodReview(context([record.id]));
  expect(item.controller.getSnapshot()).toMatchObject({ selectedIds: [], error: "journal-record-not-found", draft: { mode: "period-review", body: context().body } });
});

test("clearing a conversation while period sources load discards the late context", async () => {
  const item = setup();
  let resolve!: (value: Awaited<ReturnType<JournalService["listRecords"]>>) => void;
  jest.spyOn(item.service, "listRecords").mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const pending = item.controller.beginPeriodReview(context());
  expect(item.controller.getSnapshot().draft?.mode).toBe("period-review");
  item.controller.clear(); resolve([]);
  await expect(pending).rejects.toThrow("journal-session-changed");
  expect(item.controller.getSnapshot()).toMatchObject({ selectedIds: [], choices: [], draft: null });
});

test("an oversized initial period selection can always be reduced before sending", async () => {
  const item = setup(); const records = await Promise.all(Array.from({ length: 10 }, () => item.create()));
  await item.controller.beginPeriodReview(context(records.map(record => record.id)));
  expect(item.controller.getSnapshot().selectedIds).toHaveLength(10);
  await expect(item.controller.getRecordPayload()).rejects.toThrow("journal-selection-limit");
  item.controller.toggleSelection(records[0]!.id);
  expect(item.controller.getSnapshot().selectedIds).toHaveLength(9);
  item.controller.toggleSelection(records[1]!.id);
  expect(item.controller.getSnapshot().selectedIds).toHaveLength(8);
  expect(await item.controller.getRecordPayload()).toHaveLength(8);
});

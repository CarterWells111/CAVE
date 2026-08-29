import { JournalService, JournalServiceError } from "./journal-service";
import { InMemoryJournalRepository } from "../infrastructure/in-memory-journal-repository";

describe("JournalService", () => {
  let now = "2026-08-28T10:00:00.000Z";
  let sequence = 0;
  let repository: InMemoryJournalRepository;
  let service: JournalService;

  beforeEach(() => {
    now = "2026-08-28T10:00:00.000Z";
    sequence = 0;
    repository = new InMemoryJournalRepository();
    service = new JournalService(repository, {
      now: () => now,
      createId: () => `journal-${++sequence}`
    }, "account-a");
  });

  test("creates and lists records newest event first", async () => {
    await service.createRecord({ title: "较早", occurredAt: "2026-08-01T00:00:00Z", highlight: { kind: "feeling", text: "平静" } });
    await service.createRecord({ title: "较晚", occurredAt: "2026-08-20T00:00:00Z", highlight: { kind: "impression", text: "我说出了自己的需要" } });
    expect((await service.listRecords()).map(({ title }) => title)).toEqual(["较晚", "较早"]);
  });

  test("updates within 24 hours but refuses to overwrite a locked record", async () => {
    const record = await service.createRecord({ title: "原来的标题", occurredAt: now, highlight: { kind: "feeling", text: "紧张" } });
    now = "2026-08-29T09:59:59.999Z";
    await expect(service.updateRecord(record.id, { title: "新的标题" })).resolves.toMatchObject({ title: "新的标题" });
    now = "2026-08-29T10:00:00.000Z";
    await expect(service.updateRecord(record.id, { title: "不能覆盖" })).rejects.toEqual(new JournalServiceError("journal-item-locked"));
  });

  test("turns an expired edit into an explicit correction entry", async () => {
    const record = await service.createRecord({ title: "一件事", occurredAt: now, highlight: { kind: "feeling", text: "困惑" } });
    now = "2026-08-30T10:00:00.000Z";
    const entry = await service.createCorrectionFromExpiredEdit(record.id, {
      occurredAt: now, body: "补充说明，而不是覆盖原文"
    });
    expect(entry.kind).toBe("correction");
    expect((await service.loadRecord(record.id))?.record.highlight.text).toBe("困惑");
  });

  test("each entry has its own lock and deleting one leaves its record", async () => {
    const record = await service.createRecord({ title: "一件事", occurredAt: now, highlight: { kind: "feeling", text: "困惑" } });
    const entry = await service.addEntry(record.id, { kind: "insight", occurredAt: now, body: "后来明白了一点" });
    now = "2026-08-29T10:00:00.000Z";
    await expect(service.updateEntry(entry.id, { body: "不能覆盖" })).rejects.toEqual(new JournalServiceError("journal-item-locked"));
    await service.deleteEntry(entry.id);
    expect(await service.loadRecord(record.id)).toMatchObject({ entries: [] });
  });

  test("creates a user-confirmed period review from only selected records", async () => {
    const first = await service.createRecord({ title: "一次挫折", occurredAt: "2026-08-01T00:00:00Z", highlight: { kind: "feeling", text: "失落" } });
    await service.createRecord({ title: "不选择", occurredAt: "2026-08-02T00:00:00Z", highlight: { kind: "feeling", text: "平静" } });
    const review = await service.savePeriodReview({
      periodStart: "2026-08-01T00:00:00Z", periodEnd: "2026-08-28T23:59:59Z",
      title: "这个月的回顾", body: "我学会先确认自己的边界。", sourceRecordIds: [first.id]
    });
    expect(review.sourceRecordIds).toEqual([first.id]);
    expect(await service.listPeriodReviews()).toHaveLength(1);
  });

  test("isolates records, entries and reviews by local account owner", async () => {
    const accountB = new JournalService(repository, {
      now: () => now,
      createId: () => `account-b-${++sequence}`,
    }, "account-b");
    const record = await service.createRecord({
      title: "只属于 A",
      occurredAt: now,
      highlight: { kind: "feeling", text: "安心" },
    });
    await service.addEntry(record.id, { kind: "insight", occurredAt: now, body: "A 的补充" });

    await expect(accountB.listRecords()).resolves.toEqual([]);
    await expect(accountB.loadRecord(record.id)).resolves.toBeNull();
    await expect(accountB.updateRecord(record.id, { title: "越权修改" }))
      .rejects.toEqual(new JournalServiceError("journal-record-not-found"));
    await accountB.deleteRecord(record.id);
    await expect(service.loadRecord(record.id)).resolves.toMatchObject({
      record: { title: "只属于 A" },
      entries: [{ body: "A 的补充" }],
    });
  });

  test("clears only the current account journal", async () => {
    const accountB = new JournalService(repository, {
      now: () => now,
      createId: () => `account-b-${++sequence}`,
    }, "account-b");
    await service.createRecord({ title: "A", occurredAt: now, highlight: { kind: "feeling", text: "A" } });
    await accountB.createRecord({ title: "B", occurredAt: now, highlight: { kind: "feeling", text: "B" } });

    await service.clearCurrentAccount();

    await expect(service.listRecords()).resolves.toEqual([]);
    await expect(accountB.listRecords()).resolves.toHaveLength(1);
  });
});

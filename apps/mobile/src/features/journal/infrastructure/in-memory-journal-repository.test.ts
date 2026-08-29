import { createJournalEntry, createJournalRecord } from "../domain/journal-record";
import { InMemoryJournalRepository } from "./in-memory-journal-repository";

describe("InMemoryJournalRepository", () => {
  test("hard deletes a record and all its entries", async () => {
    const repository = new InMemoryJournalRepository();
    const record = createJournalRecord({ id: "r", title: "事件", occurredAt: "2026-01-01", createdAt: "2026-01-02T00:00:00.000Z", highlight: { kind: "feeling", text: "平静" }, source: { kind: "freeform" } });
    const entry = createJournalEntry({ id: "e", recordId: "r", kind: "action", occurredAt: "2026-01-03", createdAt: "2026-01-03T00:00:00.000Z", body: "说清楚了" });
    await repository.createRecord("account-a", record);
    await repository.createEntry("account-a", entry);
    await repository.deleteRecord("account-a", "r");
    expect(await repository.loadRecord("account-a", "r")).toBeNull();
    expect(await repository.listEntries("account-a", "r")).toEqual([]);
  });

  test("returns detached values so callers cannot mutate stored private data", async () => {
    const repository = new InMemoryJournalRepository();
    const record = createJournalRecord({ id: "r", title: "事件", occurredAt: "2026-01-01", createdAt: "2026-01-02T00:00:00.000Z", highlight: { kind: "feeling", text: "平静" }, source: { kind: "freeform" } });
    await repository.createRecord("account-a", record);
    const loaded = await repository.loadRecord("account-a", "r");
    (loaded as { title: string }).title = "外部修改";
    expect((await repository.loadRecord("account-a", "r"))?.title).toBe("事件");
  });
});

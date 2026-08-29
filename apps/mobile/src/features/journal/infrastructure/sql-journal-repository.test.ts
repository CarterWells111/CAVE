import { createJournalRecord } from "../domain/journal-record";
import { SqlJournalRepository } from "./sql-journal-repository";
import { journalDateFromDate } from "../domain/journal-date";

describe("SqlJournalRepository", () => {
  test("stores card snapshots as private JSON and reads them back", async () => {
    const runAsync = jest.fn(async () => ({ changes: 1 }));
    const row = {
      id: "r", title: "一次沟通", occurred_at: "2026-08-20T00:00:00.000Z",
      created_at: "2026-08-28T00:00:00.000Z", updated_at: "2026-08-28T00:00:00.000Z",
      editable_until: "2026-08-29T00:00:00.000Z", highlight_kind: "feeling", highlight_text: "安心",
      body: "", topics_json: "[]", source_json: '{"kind":"freeform"}',
      card_snapshot_json: '{"cardId":"c","capturedAt":"2026-08-28T00:00:00.000Z","sections":[{"id":"need","text":"我需要慢一点"}]}'
    };
    const database = { initialize: async () => ({ runAsync, getFirstAsync: async () => row, getAllAsync: async () => [] }) };
    const repository = new SqlJournalRepository(database as never);
    const record = createJournalRecord({
      id: "r", title: "一次沟通", occurredAt: row.occurred_at, createdAt: row.created_at,
      highlight: { kind: "feeling", text: "安心" }, source: { kind: "freeform" },
      cardSnapshot: { cardId: "c", capturedAt: row.created_at, sections: [{ id: "need", text: "我需要慢一点" }] }
    });
    await repository.createRecord("account-a", record);
    expect(runAsync.mock.calls[0]).toContain(JSON.stringify(record.cardSnapshot));
    expect(runAsync.mock.calls[0]).toContain("account-a");
    expect((await repository.loadRecord("account-a", "r"))?.cardSnapshot?.sections[0]?.text).toBe("我需要慢一点");
  });

  test("list query never selects body or source fields", async () => {
    const getAllAsync = jest.fn(async () => []);
    const repository = new SqlJournalRepository({ initialize: async () => ({ runAsync: jest.fn(), getFirstAsync: jest.fn(), getAllAsync }) } as never);
    await repository.listRecords("account-a");
    const sql = (getAllAsync as jest.Mock).mock.calls[0]?.[0] as string ?? "";
    expect(sql).not.toMatch(/\bbody\b|source_json|card_snapshot_json/u);
    expect(sql).toContain("owner_account_id=?");
    expect(getAllAsync).toHaveBeenCalledWith(expect.any(String), "account-a");
  });

  test("normalizes legacy timestamp rows to the device calendar day when reading", async () => {
    const legacyTimestamp = "2026-08-29T23:30:00.000-07:00";
    const getFirstAsync = jest.fn(async () => ({
      id: "legacy", title: "旧记录", occurred_at: legacyTimestamp,
      created_at: "2026-08-30T07:00:00.000Z", updated_at: "2026-08-30T07:00:00.000Z",
      editable_until: "2026-08-31T07:00:00.000Z", highlight_kind: "feeling", highlight_text: "安心",
      body: "", topics_json: "[]", source_json: '{"kind":"freeform"}', card_snapshot_json: null,
    }));
    const repository = new SqlJournalRepository({
      initialize: async () => ({ runAsync: jest.fn(), getFirstAsync, getAllAsync: jest.fn() }),
    } as never);

    await expect(repository.loadRecord("account-a", "legacy")).resolves.toMatchObject({
      occurredAt: journalDateFromDate(new Date(legacyTimestamp)),
    });
  });

  test("uses created time as the stable tie-breaker after normalizing legacy days", async () => {
    const base = {
      title: "事件", highlight_kind: "feeling" as const, highlight_text: "安心", topics_json: "[]",
    };
    const getAllAsync = jest.fn(async () => [
      { ...base, id: "older", occurred_at: "2026-08-29T20:00:00.000Z", created_at: "2026-08-29T20:00:00.000Z" },
      { ...base, id: "newer", occurred_at: "2026-08-29", created_at: "2026-08-29T21:00:00.000Z" },
    ]);
    const repository = new SqlJournalRepository({
      initialize: async () => ({ runAsync: jest.fn(), getFirstAsync: jest.fn(), getAllAsync }),
    } as never);

    await expect(repository.listRecords("account-a")).resolves.toMatchObject([
      { id: "newer", occurredAt: "2026-08-29" },
      { id: "older", occurredAt: "2026-08-29" },
    ]);
  });

  test("claims every legacy journal table for the first account in one transaction", async () => {
    const runAsync = jest.fn(async () => ({ changes: 1 }));
    const withTransaction = jest.fn(async (operation) => operation({
      runAsync,
      getFirstAsync: jest.fn(),
      getAllAsync: jest.fn(),
    }));
    const repository = new SqlJournalRepository({
      initialize: jest.fn(),
      withTransaction,
    } as never);

    await repository.claimUnowned("account-a");

    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(runAsync.mock.calls).toEqual([
      ["UPDATE journal_records SET owner_account_id=? WHERE owner_account_id IS NULL", "account-a"],
      ["UPDATE journal_period_reviews SET owner_account_id=? WHERE owner_account_id IS NULL", "account-a"],
    ]);
  });
});

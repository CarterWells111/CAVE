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
    const olderCreatedAt = new Date(2026, 7, 29, 20).toISOString();
    const newerCreatedAt = new Date(2026, 7, 29, 21).toISOString();
    const getAllAsync = jest.fn(async () => [
      { ...base, id: "older", occurred_at: olderCreatedAt, created_at: olderCreatedAt },
      { ...base, id: "newer", occurred_at: "2026-08-29", created_at: newerCreatedAt },
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

  test("checkpoints plaintext remnants after deleting one record", async () => {
    const runAsync = jest.fn(async () => ({ changes: 1 }));
    const checkpointAfterDeletion = jest.fn(async () => undefined);
    const repository = new SqlJournalRepository({
      initialize: async () => ({
        runAsync,
        getFirstAsync: jest.fn(),
        getAllAsync: jest.fn(),
      }),
      checkpointAfterDeletion,
    } as never);

    await repository.deleteRecord("account-a", "record-a");

    expect(checkpointAfterDeletion).toHaveBeenCalledTimes(1);
  });

  test("checkpoints plaintext remnants after deleting one follow-up entry", async () => {
    const runAsync = jest.fn(async () => ({ changes: 1 }));
    const checkpointAfterDeletion = jest.fn(async () => undefined);
    const repository = new SqlJournalRepository({
      initialize: async () => ({
        runAsync,
        getFirstAsync: jest.fn(),
        getAllAsync: jest.fn(),
      }),
      checkpointAfterDeletion,
    } as never);

    await repository.deleteEntry("account-a", "entry-a");

    expect(checkpointAfterDeletion).toHaveBeenCalledTimes(1);
  });

  test("reports when deletion committed but plaintext cleanup still needs retry", async () => {
    const repository = new SqlJournalRepository({
      initialize: async () => ({
        runAsync: jest.fn(async () => ({ changes: 1 })),
        getFirstAsync: jest.fn(),
        getAllAsync: jest.fn(),
      }),
      checkpointAfterDeletion: jest.fn(async () => {
        throw new Error("checkpoint-busy");
      }),
    } as never);

    await expect(repository.deleteRecord("account-a", "record-a")).rejects.toMatchObject({
      code: "JOURNAL_DELETION_CLEANUP_REQUIRED",
      deletionCommitted: true,
    });
  });

  test("does not misclassify cleanup state read failures as committed deletion cleanup", async () => {
    const stateReadFailure = new Error("cleanup-state-read-failed");
    const repository = new SqlJournalRepository({
      initialize: jest.fn(),
      withTransaction: jest.fn(),
      ensureDeletionCleanup: jest.fn(async () => {
        throw stateReadFailure;
      }),
    } as never);

    await expect(repository.ensureDeletionCleanup("account-a")).rejects.toBe(
      stateReadFailure,
    );
  });

  test("marks cleanup pending atomically before deleting content", async () => {
    const calls: string[] = [];
    const runAsync = jest.fn(async (sql: string) => {
      calls.push(sql);
      return { changes: 1 };
    });
    const markDeletionCleanupPending = jest.fn(async (connection) => {
      calls.push("mark");
      await connection.runAsync("UPDATE journal_storage_state SET cleanup_pending=1");
    });
    const withTransaction = jest.fn(async (operation) => operation({
      runAsync,
      getFirstAsync: jest.fn(),
      getAllAsync: jest.fn(),
    }));
    const repository = new SqlJournalRepository({
      initialize: jest.fn(),
      withTransaction,
      markDeletionCleanupPending,
      checkpointAfterDeletion: jest.fn(async () => undefined),
    } as never);

    await repository.deleteRecord("account-a", "record-a");

    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(markDeletionCleanupPending).toHaveBeenCalledTimes(1);
    expect(calls[0]).toBe("mark");
    expect(calls[1]).toContain("cleanup_pending=1");
    expect(calls[2]).toContain("DELETE FROM journal_records");
  });

  test("clears one account's entries explicitly before deleting its records", async () => {
    const runAsync = jest.fn(async () => ({ changes: 1 }));
    const checkpointAfterDeletion = jest.fn(async () => undefined);
    const withTransaction = jest.fn(async (operation) => operation({
      runAsync,
      getFirstAsync: jest.fn(),
      getAllAsync: jest.fn(),
    }));
    const repository = new SqlJournalRepository({
      initialize: jest.fn(),
      withTransaction,
      checkpointAfterDeletion,
    } as never);

    await repository.clearOwner("account-a");

    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(runAsync.mock.calls).toEqual([
      [
        "DELETE FROM journal_entries WHERE record_id IN (SELECT id FROM journal_records WHERE owner_account_id=?)",
        "account-a",
      ],
      ["DELETE FROM journal_period_reviews WHERE owner_account_id=?", "account-a"],
      ["DELETE FROM journal_records WHERE owner_account_id=?", "account-a"],
    ]);
    expect(checkpointAfterDeletion).toHaveBeenCalledTimes(1);
  });

  test("clears every journal table atomically in foreign-key-safe order", async () => {
    const runAsync = jest.fn(async () => ({ changes: 1 }));
    const checkpointAfterDeletion = jest.fn(async () => undefined);
    const withTransaction = jest.fn(async (operation) => operation({
      runAsync,
      getFirstAsync: jest.fn(),
      getAllAsync: jest.fn(),
    }));
    const repository = new SqlJournalRepository({
      initialize: jest.fn(async () => ({
        runAsync,
        getFirstAsync: jest.fn(),
        getAllAsync: jest.fn(),
      })),
      withTransaction,
      checkpointAfterDeletion,
    } as never);

    await repository.clearAll();

    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(runAsync.mock.calls).toEqual([
      ["DELETE FROM journal_period_reviews"],
      ["DELETE FROM journal_entries"],
      ["DELETE FROM journal_records"],
    ]);
    expect(checkpointAfterDeletion).toHaveBeenCalledTimes(1);
  });

  test("rejects a period-review id already owned by another account", async () => {
    const runAsync = jest.fn(async () => ({ changes: 0 }));
    const repository = new SqlJournalRepository({
      initialize: async () => ({
        runAsync,
        getFirstAsync: jest.fn(),
        getAllAsync: jest.fn(),
      }),
    } as never);

    await expect(repository.savePeriodReview("account-b", {
      id: "shared-review",
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-08-31T23:59:59.999Z",
      createdAt: "2026-08-29T10:00:00.000Z",
      updatedAt: "2026-08-29T10:00:00.000Z",
      editableUntil: "2026-08-30T10:00:00.000Z",
      title: "不能覆盖",
      body: "不能改属",
      sourceRecordIds: [],
    })).rejects.toThrow("journal-period-review-owner-conflict");
    const sql = (runAsync as jest.Mock).mock.calls[0]?.[0] as string;
    expect(sql).toContain("ON CONFLICT(id) DO UPDATE");
    expect(sql).not.toContain("INSERT OR REPLACE");
  });
});

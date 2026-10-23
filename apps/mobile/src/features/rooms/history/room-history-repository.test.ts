/** @jest-environment node */
import type { RoomHistoryRecord, RoomHistoryRepository } from "./room-history-repository";
import { InMemoryRoomHistoryRepository } from "./in-memory-room-history-repository";
import { SqlRoomHistoryRepository } from "./sql-room-history-repository";
import { createSqliteFileHarness } from "../../../test/storage/sqlite-file-harness";
import { deleteAllData } from "../../../core/privacy/delete-all-data";

type Harness = ReturnType<typeof createSqliteFileHarness>;
const active: Harness[] = [];
afterEach(() => { for (const harness of active.splice(0)) harness.cleanup(); });
function harness() { const value = createSqliteFileHarness(); active.push(value); return value; }
const record = (id: string, changes: Partial<RoomHistoryRecord> = {}): RoomHistoryRecord => ({
  id, roomId: "synthetic-room", scenarioId: "pause", occurredAt: "2026-10-23T10:00:00.000Z",
  action: "created", timeKind: "action", myAnswers: { expectation: "希望可以慢慢商量" }, ...changes,
});
const factories: [string, () => RoomHistoryRepository][] = [
  ["memory", () => new InMemoryRoomHistoryRepository()],
  ["SQL", () => new SqlRoomHistoryRepository(harness().manager())],
];

describe.each(factories)("%s room history", (_name, createRepository) => {
  test("isolates accounts and returns detached values containing only own answers and a visible report", async () => {
    const repository = createRepository();
    const original = record("same-event", { report: { status: "ready", sections: {
      commonAndDifferences: "共同看见各自的需要", adviceForBoth: "先互相确认", nextSteps: "保留暂停的空间",
    } } });
    await repository.save("account-a", original);
    original.myAnswers.expectation = "修改外部对象";
    await repository.save("account-b", record("same-event", { myAnswers: { boundary: "另一账号的本人回答" } }));
    const saved = await repository.list("account-a");
    expect(saved[0]!.myAnswers.expectation).toBe("希望可以慢慢商量");
    saved[0]!.myAnswers.expectation = "修改读取对象";
    expect((await repository.list("account-a"))[0]!.myAnswers.expectation).toBe("希望可以慢慢商量");
    expect((await repository.list("account-b"))[0]!.myAnswers).toEqual({ boundary: "另一账号的本人回答" });
  });

  test("preserves event timestamps and distinguishes observations from actual actions", async () => {
    const repository = createRepository();
    await repository.save("account-a", record("action", { occurredAt: "2026-10-23T11:00:00+01:00" }));
    await repository.save("account-a", record("observation", {
      occurredAt: "2026-10-23T11:00:00.000Z", action: "observed", timeKind: "observed",
    }));
    await repository.save("account-a", record("action", { occurredAt: "2026-10-24T12:00:00.000Z", action: "ended" }));
    expect(await repository.list("account-a")).toEqual([
      expect.objectContaining({ id: "observation", occurredAt: "2026-10-23T11:00:00.000Z", action: "observed", timeKind: "observed" }),
      expect.objectContaining({ id: "action", occurredAt: "2026-10-23T10:00:00.000Z", action: "created" }),
    ]);
  });

  test.each([
    { partnerAnswers: { expectation: "不可保留的对方原始回答" } },
    { myAnswers: { partner: "不可保留" } },
    { occurredAt: "not-a-time" },
    { scenarioId: "unknown" },
    { action: "observed", timeKind: "action" },
    { action: "created", timeKind: "observed" },
    { id: " padded " },
    { report: { status: "ready", sections: { commonAndDifferences: "共同", adviceForBoth: "建议", nextSteps: "下一步", rawAnswers: "不可保留" } } },
  ])("rejects unknown, private or inconsistent record fields %# before persistence", async changes => {
    const repository = createRepository();
    await expect(repository.save("account-a", { ...record("invalid"), ...changes } as RoomHistoryRecord))
      .rejects.toThrow("room-history-invalid-record");
    await expect(repository.list("account-a")).resolves.toEqual([]);
  });

  test("validates owners and clears each account independently with committed deletion notifications", async () => {
    const repository = createRepository();
    await expect(repository.list(" ")).rejects.toThrow("room-history-invalid-identifier");
    await expect(repository.save(" account-a ", record("bad"))).rejects.toThrow("room-history-invalid-identifier");
    await repository.save("account-a", record("a"));
    await repository.save("account-b", record("b"));
    const clearedA = jest.fn();
    const clearedB = jest.fn();
    const unsubscribe = repository.subscribeToOwnerClear("account-a", clearedA);
    repository.subscribeToOwnerClear("account-b", clearedB);
    await repository.clearOwner("account-a");
    await expect(repository.list("account-a")).resolves.toEqual([]);
    await expect(repository.list("account-b")).resolves.toHaveLength(1);
    expect(clearedA).toHaveBeenCalledTimes(1);
    expect(clearedB).not.toHaveBeenCalled();
    unsubscribe();
    await repository.clearAll();
    expect(clearedA).toHaveBeenCalledTimes(1);
    expect(clearedB).toHaveBeenCalledTimes(1);
    await expect(repository.list("account-b")).resolves.toEqual([]);
  });

  test("subscriber failures cannot turn committed deletion into an error", async () => {
    const repository = createRepository();
    const notified = jest.fn();
    repository.subscribeToOwnerClear("account-a", () => { throw new Error("synthetic-listener"); });
    repository.subscribeToOwnerClear("account-a", notified);
    await expect(repository.clearOwner("account-a")).resolves.toBeUndefined();
    expect(notified).toHaveBeenCalledTimes(1);
  });
});

test("SQL history persists after manager recreation", async () => {
  const h = harness();
  const manager = h.manager();
  await new SqlRoomHistoryRepository(manager).save("account-a", record("durable"));
  await manager.close();
  await expect(new SqlRoomHistoryRepository(h.manager()).list("account-a")).resolves.toEqual([record("durable")]);
});

test("SQL failed writes and failed deletion roll back without notifying subscribers", async () => {
  const h = harness();
  const repository = new SqlRoomHistoryRepository(h.manager());
  await repository.save("account-a", record("kept"));
  h.setFault((operation, sql) => {
    if (operation === "run-after" && sql.startsWith("INSERT INTO room_history")) throw new Error("synthetic-insert");
  });
  await expect(repository.save("account-a", record("rolled-back"))).rejects.toThrow("synthetic-insert");
  h.setFault();
  await expect(repository.list("account-a")).resolves.toEqual([record("kept")]);
  const notified = jest.fn();
  repository.subscribeToOwnerClear("account-a", notified);
  h.setFault((operation, sql) => {
    if (operation === "run-after" && sql.startsWith("DELETE FROM room_history")) throw new Error("synthetic-delete");
  });
  await expect(repository.clearOwner("account-a")).rejects.toThrow("synthetic-delete");
  expect(notified).not.toHaveBeenCalled();
  h.setFault();
  await expect(repository.list("account-a")).resolves.toEqual([record("kept")]);
  await repository.clearOwner("account-a");
  expect(notified).toHaveBeenCalledTimes(1);
});

test.each(["owner", "all"] as const)("SQL %s clearing invalidates queued saves and ignores writes arriving during deletion", async kind => {
  const h = harness();
  const manager = h.manager();
  const repository = new SqlRoomHistoryRepository(manager);
  await repository.save("account-a", record("old"));
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const blocker = manager.withTransaction(async () => { entered(); await blocked; });
  await started;
  const pending = repository.save("account-a", record("queued-before-deletion"));
  const clear = kind === "owner" ? repository.clearOwner("account-a") : repository.clearAll();
  const during = repository.save("account-a", record("arrived-during-deletion"));
  release();
  await Promise.all([blocker, pending, clear, during]);
  await expect(repository.list("account-a")).resolves.toEqual([]);
  // A later intentional operation can create new history after cleanup.
  await repository.save("account-a", record("new-operation"));
  await expect(repository.list("account-a")).resolves.toEqual([record("new-operation")]);
});

test("native storage deletion blocks late saves without querying a locked database and notifies only after success", async () => {
  const h = harness();
  const manager = h.manager();
  const repository = new SqlRoomHistoryRepository(manager);
  await repository.save("account-a", record("old"));
  const notified = jest.fn();
  repository.subscribeToOwnerClear("account-a", notified);
  await expect(repository.withStorageDeletion(async () => { throw new Error("synthetic-delete-intent"); }))
    .rejects.toThrow("synthetic-delete-intent");
  expect(notified).not.toHaveBeenCalled();
  await expect(repository.list("account-a")).resolves.toEqual([record("old")]);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const deleting = repository.withStorageDeletion(async () => {
    await gate;
    await deleteAllData({ database: manager, secrets: h.secrets(), accountProfiles: { clearAll: async () => undefined } });
  });
  await repository.save("account-a", record("late"));
  expect(notified).not.toHaveBeenCalled();
  release();
  await deleting;
  expect(notified).toHaveBeenCalledTimes(1);
  await expect(repository.list("account-a")).resolves.toEqual([]);
});

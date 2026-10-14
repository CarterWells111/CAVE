/** @jest-environment node */
import type { AssistantConversation, AssistantHistoryRepository } from "./assistant-history-repository";
import { InMemoryAssistantHistoryRepository } from "./in-memory-assistant-history-repository";
import { SqlAssistantHistoryRepository } from "./sql-assistant-history-repository";
import { createSqliteFileHarness } from "../../../test/storage/sqlite-file-harness";

type Harness = ReturnType<typeof createSqliteFileHarness>;
const active: Harness[] = [];
afterEach(() => { for (const harness of active.splice(0)) harness.cleanup(); });
const conversation = (id: string): AssistantConversation => ({
  id, title: `对话 ${id}`, journeyId: "first-overnight", createdAt: "2026-10-14T12:00:00.000Z", updatedAt: "2026-10-14T12:00:00.000Z",
  turns: [{ question: "今天去散步了", response: { status: "ok", providerMode: "mock", message: "想聊聊散步时的感受吗？", observations: [], sources: [] } }],
  draft: "还没发送的消息",
});
const factories: [string, () => AssistantHistoryRepository][] = [
  ["memory", () => new InMemoryAssistantHistoryRepository()],
  ["SQL", () => {
    const harness = createSqliteFileHarness(); active.push(harness);
    return new SqlAssistantHistoryRepository(harness.manager());
  }],
];

describe.each(factories)("%s assistant history", (_name, createRepository) => {
  test("isolates accounts, persists complete turns and drafts, and never leaks mutable values", async () => {
    const repository = createRepository();
    const original = conversation("same-id");
    await repository.save("account-a", original);
    original.turns[0]!.question = "修改外部对象";
    await repository.save("account-b", { ...conversation("same-id"), title: "B 的对话" });
    const firstRead = await repository.list("account-a");
    expect(firstRead).toEqual([conversation("same-id")]);
    firstRead[0]!.turns[0]!.question = "修改读取对象";
    expect((await repository.list("account-a"))[0]!.turns[0]!.question).toBe("今天去散步了");
    await repository.delete("account-a", "same-id");
    await expect(repository.list("account-a")).resolves.toEqual([]);
    await expect(repository.list("account-b")).resolves.toEqual([expect.objectContaining({ title: "B 的对话" })]);
  });

  test("places new conversations first and keeps a manually sorted conversation in place when updated", async () => {
    const repository = createRepository();
    await repository.save("account-a", conversation("a"));
    await repository.save("account-a", conversation("b"));
    await repository.reorder("account-a", ["a", "b"]);
    await repository.save("account-a", { ...conversation("b"), title: "更新 B" });
    expect((await repository.list("account-a")).map(item => item.id)).toEqual(["a", "b"]);
    await repository.save("account-a", conversation("c"));
    expect((await repository.list("account-a")).map(item => item.id)).toEqual(["c", "a", "b"]);
  });

  test.each([{ ids: ["a"] }, { ids: ["a", "a"] }, { ids: ["a", "other-owner-id"] }])("rejects incomplete, duplicate, or foreign-account order $ids without changes", async ({ ids }) => {
    const repository = createRepository();
    await repository.save("account-a", conversation("a"));
    await repository.save("account-a", conversation("b"));
    await repository.save("account-b", conversation("other-owner-id"));
    await expect(repository.reorder("account-a", ids)).rejects.toThrow("assistant-history-invalid-order");
    expect((await repository.list("account-a")).map(item => item.id)).toEqual(["b", "a"]);
  });

  test("clears one owner independently, then clears all owners", async () => {
    const repository = createRepository();
    await repository.save("account-a", conversation("a"));
    await repository.save("account-b", conversation("b"));
    await repository.clearOwner("account-a");
    await expect(repository.list("account-a")).resolves.toEqual([]);
    await expect(repository.list("account-b")).resolves.toHaveLength(1);
    await repository.clearAll();
    await expect(repository.list("account-b")).resolves.toEqual([]);
  });

  test("notifies only the cleared account after successful owner deletion and supports unsubscribe", async () => {
    const repository = createRepository();
    await repository.save("account-a", conversation("a"));
    await repository.save("account-b", conversation("b"));
    const accountA = jest.fn();
    const accountB = jest.fn();
    const unsubscribeA = repository.subscribeToOwnerClear!("account-a", accountA);
    repository.subscribeToOwnerClear!("account-b", accountB);
    await repository.clearOwner("account-a");
    expect(accountA).toHaveBeenCalledTimes(1);
    expect(accountB).not.toHaveBeenCalled();
    await expect(repository.list("account-a")).resolves.toEqual([]);
    await expect(repository.list("account-b")).resolves.toHaveLength(1);
    unsubscribeA();
    await repository.clearOwner("account-a");
    expect(accountA).toHaveBeenCalledTimes(1);
  });

  test("clearAll notifies every subscribed owner, including owners without stored conversations", async () => {
    const repository = createRepository();
    await repository.save("account-a", conversation("a"));
    const accountA = jest.fn();
    const accountB = jest.fn();
    repository.subscribeToOwnerClear!("account-a", accountA);
    repository.subscribeToOwnerClear!("account-b", accountB);
    await repository.clearAll();
    expect(accountA).toHaveBeenCalledTimes(1);
    expect(accountB).toHaveBeenCalledTimes(1);
    await expect(repository.list("account-a")).resolves.toEqual([]);
  });

  test("a failing subscriber cannot stop other subscribers or make committed deletion fail", async () => {
    const repository = createRepository();
    const notified = jest.fn();
    repository.subscribeToOwnerClear!("account-a", () => { throw new Error("synthetic-listener-failure"); });
    repository.subscribeToOwnerClear!("account-a", notified);
    await expect(repository.clearOwner("account-a")).resolves.toBeUndefined();
    expect(notified).toHaveBeenCalledTimes(1);
  });

  test("rejects invalid owner and corrupt data before writing", async () => {
    const repository = createRepository();
    await expect(repository.save(" ", conversation("a"))).rejects.toThrow("assistant-history-invalid-identifier");
    await expect(repository.save("account-a", { ...conversation("a"), turns: [{ question: "", response: conversation("a").turns[0]!.response }] }))
      .rejects.toThrow("assistant-history-invalid-conversation");
    await expect(repository.list("account-a")).resolves.toEqual([]);
  });
});

test("SQL history survives manager recreation and rolls back a partially written reorder", async () => {
  const harness = createSqliteFileHarness(); active.push(harness);
  const firstManager = harness.manager();
  const repository = new SqlAssistantHistoryRepository(firstManager);
  for (const id of ["a", "b", "c"]) await repository.save("account-a", conversation(id));
  await firstManager.close();
  const reopened = new SqlAssistantHistoryRepository(harness.manager());
  await expect(reopened.list("account-a")).resolves.toEqual([conversation("c"), conversation("b"), conversation("a")]);
  let writes = 0;
  harness.setFault((operation, sql) => {
    if (operation === "run-after" && sql.startsWith("UPDATE assistant_conversations SET sort_order") && ++writes === 2) throw new Error("synthetic-reorder-failure");
  });
  await expect(reopened.reorder("account-a", ["a", "b", "c"])).rejects.toThrow("synthetic-reorder-failure");
  harness.setFault();
  expect((await reopened.list("account-a")).map(item => item.id)).toEqual(["c", "b", "a"]);
});


test.each(["clearOwner", "clearAll"] as const)("SQL %s failure does not notify subscribers or clear their stored history", async operation => {
  const harness = createSqliteFileHarness(); active.push(harness);
  const repository = new SqlAssistantHistoryRepository(harness.manager());
  await repository.save("account-a", conversation("a"));
  const notified = jest.fn();
  repository.subscribeToOwnerClear("account-a", notified);
  harness.setFault((stage, sql) => {
    if (stage === "run" && sql.startsWith("DELETE FROM assistant_conversations")) throw new Error("synthetic-delete-failure");
  });
  await expect(operation === "clearOwner" ? repository.clearOwner("account-a") : repository.clearAll()).rejects.toThrow("synthetic-delete-failure");
  expect(notified).not.toHaveBeenCalled();
  await expect(repository.list("account-a")).resolves.toEqual([conversation("a")]);
  harness.setFault();
  if (operation === "clearOwner") await repository.clearOwner("account-a");
  else await repository.clearAll();
  expect(notified).toHaveBeenCalledTimes(1);
});

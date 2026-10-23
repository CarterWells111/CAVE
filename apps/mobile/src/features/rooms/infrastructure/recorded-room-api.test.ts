import type { Room, RoomApi } from "../domain/room";
import { InMemoryRoomHistoryRepository } from "../history/in-memory-room-history-repository";
import { createFakeRoomServer } from "./fake-room-api";
import { createRecordedRoomApi } from "./recorded-room-api";

function harness(api: RoomApi, repository = new InMemoryRoomHistoryRepository()) {
  let owner = "alice";
  let sequence = 0;
  const capture = createRecordedRoomApi({ api, repository, ownerAccountId: "alice",
    now: () => "2026-10-23T12:00:00.000Z", createId: () => "event-" + ++sequence,
    isCurrentAccount: () => owner === "alice" });
  return { ...capture, repository, switchAccount: () => { owner = "bob"; } };
}

test("keeps real own-answer events after a room ends without retaining invitations or partner answers", async () => {
  const server = createFakeRoomServer();
  const alice = harness(server.forAccount("alice"));
  const bob = server.forAccount("bob");
  const created = await alice.api.create("pause");
  await alice.api.saveAnswer(created.id, "expectation", "我需要一点时间");
  await bob.join(await alice.api.issueInvite(created.id));
  await bob.saveAnswer(created.id, "boundary", "对方私有原文");
  await alice.api.complete(created.id, true);
  await bob.complete(created.id, true);
  await alice.api.generateReport(created.id);
  await alice.api.end(created.id);
  const rows = await alice.repository.list("alice");
  expect(rows.map(row => row.action)).toEqual(expect.arrayContaining(["created", "answer-saved", "completed", "report-generated", "ended"]));
  expect(rows.find(row => row.action === "answer-saved")?.myAnswers).toEqual({ expectation: "我需要一点时间" });
  expect(rows.find(row => row.action === "report-generated")?.report).toBeDefined();
  expect(JSON.stringify(rows)).not.toContain("对方私有原文");
  expect(JSON.stringify(rows)).not.toContain("inviteToken");
  expect(await alice.repository.list("bob")).toEqual([]);
  alice.dispose();
});

test("old room snapshots retain observation time and unchanged refreshes are not duplicated across hook instances", async () => {
  const server = createFakeRoomServer();
  const remote = server.forAccount("alice");
  const old = await remote.create("adjust");
  await remote.saveAnswer(old.id, "concern", "之前留下的真实回答");
  const repository = new InMemoryRoomHistoryRepository();
  const persist = jest.spyOn(repository, "save");
  const first = harness(remote, repository);
  await first.api.get(old.id);
  await first.api.list();
  first.dispose();
  const second = harness(remote, repository);
  await second.api.get(old.id);
  const rows = await repository.list("alice");
  expect(rows).toHaveLength(1);
  expect(persist).toHaveBeenCalledTimes(1);
  expect(rows[0]).toMatchObject({ action: "observed", timeKind: "observed", occurredAt: "2026-10-23T12:00:00.000Z" });
  second.dispose();
});

test("does not copy a report without both completed participants and current report consent", async () => {
  const room: Room = { id: "room-a", scenarioId: "pause", status: "reported", participantCount: 2,
    myRole: "A", myAnswers: {}, myCompleted: true, partnerCompleted: true, reportConsent: false,
    report: { status: "ready", sections: { commonAndDifferences: "公共报告", adviceForBoth: "建议", nextSteps: "下一步" } } };
  const server = createFakeRoomServer();
  const capture = harness({ ...server.forAccount("alice"), get: async () => room });
  await capture.api.get(room.id);
  expect((await capture.repository.list("alice"))[0]?.report).toBeUndefined();
  capture.dispose();
});

test("does not turn a successful remote action into a failed action when local history persistence fails", async () => {
  const server = createFakeRoomServer();
  const capture = harness(server.forAccount("alice"));
  jest.spyOn(capture.repository, "save").mockRejectedValueOnce(new Error("synthetic-storage-failure"));
  const created = await capture.api.create("pause");
  expect(created.status).toBe("waiting");
  expect(capture.api.historyWarning).toContain("房间操作已完成");
  expect(await server.forAccount("alice").get(created.id)).toBeDefined();
  capture.dispose();
});

test("does not archive a failed remote operation", async () => {
  const server = createFakeRoomServer();
  const capture = harness({ ...server.forAccount("alice"), create: async () => { throw new Error("network-failed"); } });
  await expect(capture.api.create("pause")).rejects.toThrow("network-failed");
  expect(await capture.repository.list("alice")).toEqual([]);
  capture.dispose();
});

test.each(["account", "clear", "dispose"])("a late room response cannot write after %s boundary", async boundary => {
  const server = createFakeRoomServer();
  const remote = server.forAccount("alice");
  const room = await remote.create("pause");
  let resolve!: (value: Room) => void;
  const result = new Promise<Room>(complete => { resolve = complete; });
  const capture = harness({ ...remote, get: () => result });
  const pending = capture.api.get(room.id);
  if (boundary === "account") capture.switchAccount();
  else if (boundary === "clear") await capture.repository.clearOwner("alice");
  else capture.dispose();
  resolve(room);
  await pending;
  expect(await capture.repository.list("alice")).toEqual([]);
  expect(await capture.repository.list("bob")).toEqual([]);
  capture.dispose();
});

test("list omission of an already visible report does not manufacture repeated observations", async () => {
  const server = createFakeRoomServer();
  const room: Room = { id: "reported-room", scenarioId: "pause", status: "reported", participantCount: 2,
    myAnswers: { expectation: "真实回答" }, myCompleted: true, partnerCompleted: true, reportConsent: true,
    report: { status: "ready", sections: { commonAndDifferences: "共同报告", adviceForBoth: "共同建议", nextSteps: "下一步" } } };
  const { report: omittedReport, ...listed } = room; void omittedReport;
  const remote: RoomApi = { ...server.forAccount("alice"), get: async () => room, list: async () => [listed] };
  const capture = harness(remote);
  const persist = jest.spyOn(capture.repository, "save");
  await capture.api.get(room.id); await capture.api.list(); await capture.api.get(room.id);
  expect(persist).toHaveBeenCalledTimes(1);
  expect((await capture.repository.list("alice"))[0]?.report).toEqual(room.report);
  capture.dispose();
});

test("concurrent API consumers share account-scoped observation deduplication", async () => {
  const server = createFakeRoomServer();
  const remote = server.forAccount("alice"), room = await remote.create("pause");
  const repository = new InMemoryRoomHistoryRepository();
  const persist = jest.spyOn(repository, "save");
  const first = harness(remote, repository), second = harness(remote, repository);
  await Promise.all([first.api.get(room.id), second.api.get(room.id)]);
  expect(persist).toHaveBeenCalledTimes(1);
  expect(await repository.list("alice")).toHaveLength(1);
  first.dispose(); second.dispose();
});

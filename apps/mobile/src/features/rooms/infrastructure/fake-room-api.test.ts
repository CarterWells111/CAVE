import { ROOM_QUESTION_IDS, mayGenerateReport } from "../domain/room";
import { createFakeRoomServer } from "./fake-room-api";

test("two accounts answer independently, skip questions, and receive the same report", async () => {
  const server = createFakeRoomServer();
  const alice = server.forAccount("alice");
  const bob = server.forAccount("bob");
  const created = await alice.create("pause");
  expect(created.status).toBe("waiting");
  await alice.saveAnswer(created.id, "expectation", "需要一点时间");
  const firstToken = await alice.issueInvite(created.id);
  const secondToken = await alice.issueInvite(created.id);
  await expect(bob.join(firstToken)).rejects.toThrow("INVITE_UNAVAILABLE");
  const joined = await bob.join(secondToken);
  expect(joined.myAnswers).toEqual({});
  await bob.saveAnswer(created.id, "boundary", "请先停下来");
  expect((await alice.get(created.id)).myAnswers).toEqual({ expectation: "需要一点时间" });
  expect((await bob.get(created.id)).myAnswers).toEqual({ boundary: "请先停下来" });
  await expect(alice.complete(created.id, false)).rejects.toThrow("CONSENT_REQUIRED");
  await alice.complete(created.id, true);
  expect(mayGenerateReport(await alice.get(created.id))).toBe(false);
  await bob.complete(created.id, true);
  expect(mayGenerateReport(await bob.get(created.id))).toBe(true);
  const report = (await bob.generateReport(created.id)).report;
  expect(report?.status).toBe("ready");
  expect((await alice.get(created.id)).report).toEqual(report);
  expect((await alice.get(created.id)).myAnswers).not.toEqual((await bob.get(created.id)).myAnswers);
  expect(ROOM_QUESTION_IDS).toHaveLength(4);
});

test("empty voluntary answers produce an insufficient report, and either person can end", async () => {
  const server = createFakeRoomServer();
  const alice = server.forAccount("alice");
  const bob = server.forAccount("bob");
  const room = await alice.create("adjust");
  await bob.join(await alice.issueInvite(room.id));
  await alice.complete(room.id, true);
  await bob.complete(room.id, true);
  expect((await alice.generateReport(room.id)).report?.status).toBe("insufficient");
  await bob.end(room.id);
  expect((await alice.get(room.id)).status).toBe("ended");
  await expect(alice.issueInvite(room.id)).rejects.toThrow("INVITE_UNAVAILABLE");
});

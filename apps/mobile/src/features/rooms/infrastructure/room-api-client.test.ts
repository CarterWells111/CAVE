import { createRoomApiClient } from "./room-api-client";

test("adapter sends bearer authorization and exposes only this user's answer fields", async () => {
  const fetch = jest.fn(async () => ({ ok: true, json: async () => ({
    id: "r1", scenarioId: "first-overnight", status: "active", participantCount: 2,
    myCompleted: false, partnerCompleted: true, reportConsent: false,
    myAnswers: { expectation: "mine" }, partnerAnswers: { expectation: "private" },
  }) })) as unknown as typeof globalThis.fetch;
  const api = createRoomApiClient({ baseUrl: "https://api.example.test/", getAccessToken: async () => "access", fetch });
  const room = await api.get("r1");
  expect(room.myAnswers).toEqual({ expectation: "mine" });
  expect(JSON.stringify(room)).not.toContain("private");
  expect(fetch).toHaveBeenCalledWith("https://api.example.test/v1/rooms/r1", expect.objectContaining({
    method: "GET", headers: expect.objectContaining({ Authorization: "Bearer access" }),
  }));
});

test("report parser preserves per-person advice and neutral insufficient state", async () => {
  const response = (report: object) => ({ ok: true, json: async () => ({
    id: "r1", scenarioId: "pause", status: "reported", participantCount: 2,
    myCompleted: true, partnerCompleted: true, reportConsent: true, myAnswers: {}, report,
  }) });
  const fetch = jest.fn().mockResolvedValueOnce(response({
    status: "ready", commonGround: [{ text: "共同点", evidence: ["A.expectation"] }],
    differences: [{ text: "差异", evidence: ["B.boundary"] }],
    advice: { A: [{ say: "A 说", do: "A 做" }], B: [{ say: "B 说", do: "B 做" }] },
    togetherNextSteps: [{ text: "下一步" }], uncertainties: [{ text: "未知" }],
  })).mockResolvedValueOnce(response({ status: "insufficient", message: "信息不足" })) as typeof globalThis.fetch;
  const api = createRoomApiClient({ baseUrl: "https://api.example.test", getAccessToken: async () => "access", fetch });
  expect((await api.get("r1")).report).toMatchObject({ status: "ready", advice: { A: [{ say: "A 说", do: "A 做" }], B: [{ say: "B 说", do: "B 做" }] } });
  expect((await api.get("r1")).report).toEqual({ status: "insufficient", message: "信息不足" });
});

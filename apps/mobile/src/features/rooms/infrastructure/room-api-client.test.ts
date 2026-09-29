import { createRoomApiClient, RoomApiError } from "./room-api-client";

jest.mock("expo-crypto", () => ({ getRandomBytes: (length: number) => new Uint8Array(length).fill(1) }));

const id = "6cc380dd-f5b0-4e39-bac4-54fa9b4abcc1";
const requestId = "01010101-0101-4101-8101-010101010101";
const expiresAt = "2026-10-29T00:00:00.000Z";
const room = (overrides: object = {}) => ({
  id, scenario: "pause", role: "owner", partnerJoined: true,
  ownCompleted: false, partnerCompleted: false, reportStatus: "waiting", expiresAt, ...overrides,
});
const wrapped = (data: object) => ({ contractVersion: "1", requestId, ...data });
const ok = (data: object) => ({ ok: true, status: 200, json: async () => wrapped(data) });
const readyReport = {
  version: "paired-report-v0.1", scenarioId: "pause", status: "ready",
  commonGround: [{ text: "共同点", evidence: ["A.expectation", "B.expectation"] }],
  differences: [{ text: "差异", evidence: ["A.boundary", "B.boundary"] }],
  advice: {
    A: [{ say: "A 说", do: "A 做", evidence: ["A.expectation"] }],
    B: [{ say: "B 说", do: "B 做", evidence: ["B.expectation"] }],
  },
  togetherNextSteps: [{ text: "下一步", evidence: ["A.expectation", "B.expectation"] }],
  uncertainties: [{ text: "未知", evidence: ["A.concern"] }],
};

test("list and read use the backend envelope; only own answers enter the app model", async () => {
  const fetch = jest.fn().mockResolvedValueOnce(ok({ rooms: [{ room: room(), ownAnswers: ["mine", "", "", ""] }] }))
    .mockResolvedValueOnce(ok({ room: room({ reportStatus: "ready", ownCompleted: true, partnerCompleted: true }), ownAnswers: ["mine", "", "", ""] }))
    .mockResolvedValueOnce(ok({ roomId: id, report: readyReport })) as typeof globalThis.fetch;
  const api = createRoomApiClient({ baseUrl: "https://api.example.test/", getAccessToken: async () => "access", fetch });
  expect((await api.list())[0]).toMatchObject({ myAnswers: { expectation: "mine" }, status: "active" });
  const detail = await api.get(id);
  expect(detail.report).toMatchObject({ status: "ready", advice: { A: [{ say: "A 说", do: "A 做" }] } });
  expect(JSON.stringify(detail)).not.toContain("partnerAnswers");
  expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/v1\/rooms\?requestId=/u), expect.objectContaining({
    method: "GET", headers: expect.objectContaining({ Authorization: "Bearer access" }),
  }));
  expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/v1\/rooms\/.*\/report\?requestId=/u), expect.anything());
});

test("saving one answer sends the complete own four-slot tuple", async () => {
  const fetch = jest.fn().mockResolvedValueOnce(ok({ room: room(), ownAnswers: ["first", "", "", ""] }))
    .mockResolvedValueOnce(ok({ room: room(), ownAnswers: ["first", "", "boundary", ""] })) as typeof globalThis.fetch;
  const api = createRoomApiClient({ baseUrl: "https://api.example.test", getAccessToken: async () => "access", fetch });
  expect((await api.saveAnswer(id, "boundary", "boundary")).myAnswers.boundary).toBe("boundary");
  const options = (fetch as jest.Mock).mock.calls[1][1] as RequestInit;
  expect(options.method).toBe("PUT");
  expect(JSON.parse(String(options.body))).toMatchObject({ contractVersion: "1", answers: ["first", "", "boundary", ""] });
});

test("completion records explicit consent even when all optional answers were skipped", async () => {
  const fetch = jest.fn().mockResolvedValueOnce(ok({ room: room(), ownAnswers: null }))
    .mockResolvedValueOnce(ok({ room: room(), ownAnswers: ["", "", "", ""] }))
    .mockResolvedValueOnce(ok({ room: room({ ownCompleted: true }), ownAnswers: ["", "", "", ""] })) as typeof globalThis.fetch;
  const api = createRoomApiClient({ baseUrl: "https://api.example.test", getAccessToken: async () => "access", fetch });
  await expect(api.complete(id, false)).rejects.toMatchObject({ code: "ROOM_CONSENT_REQUIRED" });
  expect((await api.complete(id, true)).myCompleted).toBe(true);
  expect(JSON.parse(String((fetch as jest.Mock).mock.calls[1][1].body))).toMatchObject({ answers: ["", "", "", ""] });
  expect(JSON.parse(String((fetch as jest.Mock).mock.calls[2][1].body))).toMatchObject({ authorizeSharedReport: true });
});

test("server error code is preserved for an expired invite", async () => {
  const fetch = jest.fn(async () => ({ ok: false, status: 400, json: async () => wrapped({ code: "ROOM_INVITATION_INVALID" }) })) as unknown as typeof globalThis.fetch;
  const api = createRoomApiClient({ baseUrl: "https://api.example.test", getAccessToken: async () => "access", fetch });
  await expect(api.join("cave_ri_" + "a".repeat(43))).rejects.toEqual(new RoomApiError("ROOM_INVITATION_INVALID", 400));
});

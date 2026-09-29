import type { Room, RoomApi, RoomQuestionId, RoomScenarioId, RoomReport } from "../domain/room";
import { isRoomScenarioId, ROOM_QUESTION_IDS } from "../domain/room";

export class RoomApiError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
    this.name = "RoomApiError";
  }
}

type Dependencies = Readonly<{
  baseUrl: string;
  getAccessToken(): Promise<string>;
  fetch?: typeof globalThis.fetch;
}>;

function parseReport(value: unknown): RoomReport | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const data = value as Record<string, unknown>;
  if ((data.status === "paused" || data.status === "insufficient") && typeof data.message === "string") {
    return { status: data.status, message: data.message };
  }
  if (data.status !== "ready") return undefined;
  const texts = (items: unknown): string[] | null => Array.isArray(items) && items.every((item) => typeof item === "object" && item !== null && typeof item.text === "string")
    ? items.map((item: { text: string }) => item.text) : null;
  const commonGround = texts(data.commonGround);
  const differences = texts(data.differences);
  const togetherNextSteps = texts(data.togetherNextSteps);
  const uncertainties = texts(data.uncertainties);
  const rawAdvice = typeof data.advice === "object" && data.advice !== null ? data.advice as Record<string, unknown> : null;
  const advice = (items: unknown): { say: string; do: string }[] | null => Array.isArray(items) && items.every((item) => typeof item === "object" && item !== null && typeof item.say === "string" && typeof item.do === "string")
    ? items.map((item: { say: string; do: string }) => ({ say: item.say, do: item.do })) : null;
  const a = advice(rawAdvice?.A);
  const b = advice(rawAdvice?.B);
  return commonGround && differences && togetherNextSteps && uncertainties && a && b
    ? { status: "ready", commonGround, differences, togetherNextSteps, uncertainties, advice: { A: a, B: b } }
    : undefined;
}

// This adapter is the only place where the room HTTP contract is assumed. It can
// be replaced without changing routes or allowing room data into journey storage.
export function createRoomApiClient({ baseUrl, getAccessToken, fetch = globalThis.fetch }: Dependencies): RoomApi {
  const origin = baseUrl.replace(/\/+$/u, "");
  if (!/^https?:\/\//u.test(origin)) throw new Error("room-api-base-url-required");
  async function request(path: string, method: "GET" | "POST" | "PUT", body?: object): Promise<unknown> {
    let response: Response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      response = await fetch(`${origin}${path}`, {
        method,
        cache: "no-store",
        headers: { Authorization: `Bearer ${await getAccessToken()}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
    } catch {
      throw new RoomApiError("NETWORK_ERROR", 0);
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new RoomApiError(`HTTP_${response.status}`, response.status);
    try { return await response.json(); } catch { throw new RoomApiError("INVALID_RESPONSE", response.status); }
  }
  const room = (value: unknown): Room => {
    if (typeof value !== "object" || value === null) throw new RoomApiError("INVALID_RESPONSE", 200);
    const data = value as Record<string, unknown>;
    if (typeof data.id !== "string" || !isRoomScenarioId(data.scenarioId)
      || !["waiting", "active", "ready", "reported", "ended"].includes(String(data.status))
      || typeof data.participantCount !== "number" || typeof data.myCompleted !== "boolean"
      || typeof data.partnerCompleted !== "boolean" || typeof data.reportConsent !== "boolean"
      || typeof data.myAnswers !== "object" || data.myAnswers === null) throw new RoomApiError("INVALID_RESPONSE", 200);
    const answers: Partial<Record<RoomQuestionId, string>> = {};
    for (const id of ROOM_QUESTION_IDS) {
      const answer = (data.myAnswers as Record<string, unknown>)[id];
      if (typeof answer === "string") answers[id] = answer;
    }
    const report = parseReport(data.report);
    return {
      id: data.id, scenarioId: data.scenarioId, status: data.status as Room["status"],
      participantCount: data.participantCount, myCompleted: data.myCompleted,
      ...(data.myRole === "A" || data.myRole === "B" ? { myRole: data.myRole } : {}),
      partnerCompleted: data.partnerCompleted, reportConsent: data.reportConsent, myAnswers: answers,
      ...(typeof data.inviteToken === "string" ? { inviteToken: data.inviteToken } : {}),
      ...(report ? { report } : {}),
    };
  };
  return {
    list: async () => {
      const result = await request("/v1/rooms", "GET");
      if (!Array.isArray(result)) throw new RoomApiError("INVALID_RESPONSE", 200);
      return result.map(room);
    },
    create: async (scenarioId: RoomScenarioId) => room(await request("/v1/rooms", "POST", { scenarioId })),
    issueInvite: async (roomId: string) => {
      const result = await request(`/v1/rooms/${encodeURIComponent(roomId)}/invite`, "POST");
      if (typeof result !== "object" || result === null || typeof (result as Record<string, unknown>).inviteToken !== "string") throw new RoomApiError("INVALID_RESPONSE", 200);
      return (result as { inviteToken: string }).inviteToken;
    },
    join: async (inviteToken: string) => room(await request("/v1/rooms/join", "POST", { inviteToken })),
    get: async (roomId: string) => room(await request(`/v1/rooms/${encodeURIComponent(roomId)}`, "GET")),
    saveAnswer: async (roomId, questionId, answer) => room(await request(`/v1/rooms/${encodeURIComponent(roomId)}/answers/${questionId}`, "PUT", { answer })),
    complete: async (roomId, reportConsent) => room(await request(`/v1/rooms/${encodeURIComponent(roomId)}/complete`, "POST", { reportConsent })),
    generateReport: async (roomId) => room(await request(`/v1/rooms/${encodeURIComponent(roomId)}/report`, "POST")),
    end: async (roomId) => room(await request(`/v1/rooms/${encodeURIComponent(roomId)}/end`, "POST")),
  };
}

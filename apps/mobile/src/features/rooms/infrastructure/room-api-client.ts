import {
  CreateRoomResponseSchema, ReissueRoomInvitationResponseSchema, RoomListResponseSchema,
  RoomReportResponseSchema, RoomStatusResponseSchema,
  type RoomAnswers, type RoomReport as ContractReport, type RoomStatus as ContractStatus,
} from "@cave/contracts";
import * as ExpoCrypto from "expo-crypto";
import type { Room, RoomApi, RoomQuestionId, RoomScenarioId, RoomReport } from "../domain/room";
import { ROOM_QUESTION_IDS } from "../domain/room";

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

function reportFromContract(report: ContractReport): RoomReport {
  if (report.status !== "ready") return { status: report.status, message: report.message };
  return {
    status: "ready",
    commonGround: report.commonGround.map(item => item.text),
    differences: report.differences.map(item => item.text),
    advice: {
      A: report.advice.A.map(({ say, do: action }) => ({ say, do: action })),
      B: report.advice.B.map(({ say, do: action }) => ({ say, do: action })),
    },
    togetherNextSteps: report.togetherNextSteps.map(item => item.text),
    uncertainties: report.uncertainties.map(item => item.text),
  };
}

function roomFromContract(status: ContractStatus, ownAnswers: RoomAnswers | null, report?: RoomReport): Room {
  const answers = Object.fromEntries(ROOM_QUESTION_IDS.map((id, index) => [id, ownAnswers?.[index] ?? ""])) as Record<RoomQuestionId, string>;
  return {
    id: status.id,
    scenarioId: status.scenario,
    status: ["ready", "paused", "insufficient"].includes(status.reportStatus) ? "reported"
      : status.ownCompleted && status.partnerCompleted ? "ready"
      : status.partnerJoined ? "active" : "waiting",
    participantCount: status.partnerJoined ? 2 : 1,
    myRole: status.role === "owner" ? "A" : "B",
    myAnswers: answers,
    myCompleted: status.ownCompleted,
    partnerCompleted: status.partnerCompleted,
    reportConsent: status.ownCompleted,
    ...(report ? { report } : {}),
  };
}

function requestId(): string {
  const bytes = ExpoCrypto.getRandomBytes(16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createRoomApiClient({ baseUrl, getAccessToken, fetch = globalThis.fetch }: Dependencies): RoomApi {
  const origin = baseUrl.replace(/\/+$/u, "");
  if (!/^https?:\/\//u.test(origin)) throw new Error("room-api-base-url-required");
  const action = () => ({ contractVersion: "1" as const, requestId: requestId() });

  async function request(path: string, method: "GET" | "POST" | "PUT" | "DELETE", body?: object): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let response: Response;
    try {
      response = await fetch(`${origin}${path}`, {
        method, cache: "no-store", signal: controller.signal,
        headers: { Authorization: `Bearer ${await getAccessToken()}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new RoomApiError("NETWORK_ERROR", 0);
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      const raw: unknown = await response.json().catch(() => null);
      const code = raw && typeof raw === "object" && "code" in raw && typeof raw.code === "string"
        ? raw.code : `HTTP_${response.status}`;
      throw new RoomApiError(code, response.status);
    }
    if (response.status === 204) return null;
    try { return await response.json(); } catch { throw new RoomApiError("INVALID_RESPONSE", response.status); }
  }

  function parse<T>(schema: { parse(value: unknown): T }, value: unknown): T {
    try { return schema.parse(value); } catch { throw new RoomApiError("INVALID_RESPONSE", 200); }
  }
  async function status(roomId: string) {
    return parse(RoomStatusResponseSchema, await request(`/v1/rooms/${encodeURIComponent(roomId)}?requestId=${requestId()}`, "GET"));
  }
  async function get(roomId: string): Promise<Room> {
    const result = await status(roomId);
    let report: RoomReport | undefined;
    if (["ready", "paused", "insufficient"].includes(result.room.reportStatus)) {
      const saved = parse(RoomReportResponseSchema, await request(`/v1/rooms/${encodeURIComponent(roomId)}/report?requestId=${requestId()}`, "GET"));
      report = reportFromContract(saved.report);
    }
    return roomFromContract(result.room, result.ownAnswers, report);
  }

  return {
    list: async () => {
      const result = parse(RoomListResponseSchema, await request(`/v1/rooms?requestId=${requestId()}`, "GET"));
      return result.rooms.map(({ room, ownAnswers }) => roomFromContract(room, ownAnswers));
    },
    create: async (scenarioId: RoomScenarioId) => {
      const result = parse(CreateRoomResponseSchema, await request("/v1/rooms", "POST", { ...action(), scenario: scenarioId, adultConfirmed: true }));
      return roomFromContract(result.room, null);
    },
    issueInvite: async (roomId: string) => {
      const result = parse(ReissueRoomInvitationResponseSchema, await request(`/v1/rooms/${encodeURIComponent(roomId)}/invitation`, "POST", action()));
      return result.invitationToken;
    },
    join: async (invitationToken: string) => {
      const result = parse(RoomStatusResponseSchema, await request("/v1/rooms/join", "POST", { ...action(), invitationToken, adultConfirmed: true }));
      return roomFromContract(result.room, result.ownAnswers);
    },
    get,
    saveAnswer: async (roomId, questionId, answer) => {
      const current = await status(roomId);
      const answers = [...(current.ownAnswers ?? ["", "", "", ""])] as RoomAnswers;
      answers[ROOM_QUESTION_IDS.indexOf(questionId)] = answer;
      const updated = parse(RoomStatusResponseSchema, await request(`/v1/rooms/${encodeURIComponent(roomId)}/answers`, "PUT", { ...action(), answers }));
      return roomFromContract(updated.room, updated.ownAnswers);
    },
    complete: async (roomId, reportConsent) => {
      if (!reportConsent) throw new RoomApiError("ROOM_CONSENT_REQUIRED", 400);
      const current = await status(roomId);
      if (!current.ownAnswers) {
        await request(`/v1/rooms/${encodeURIComponent(roomId)}/answers`, "PUT", { ...action(), answers: ["", "", "", ""] });
      }
      const result = parse(RoomStatusResponseSchema, await request(`/v1/rooms/${encodeURIComponent(roomId)}/complete`, "POST", { ...action(), authorizeSharedReport: true }));
      return roomFromContract(result.room, result.ownAnswers);
    },
    generateReport: async (roomId) => {
      const result = parse(RoomReportResponseSchema, await request(`/v1/rooms/${encodeURIComponent(roomId)}/report`, "POST", action()));
      const current = await status(roomId);
      return roomFromContract(current.room, current.ownAnswers, reportFromContract(result.report));
    },
    end: async (roomId) => {
      const current = await status(roomId);
      await request(`/v1/rooms/${encodeURIComponent(roomId)}`, "DELETE", action());
      return { ...roomFromContract(current.room, null), status: "ended", myAnswers: {} };
    },
  };
}

import {
  RoomAnswersSchema, RoomReportSchema, type CompleteRoomAnswersRequest, type CreateRoomRequest,
  type CreateRoomResponse, type JoinRoomRequest, type ReissueRoomInvitationResponse, type RoomAnswers, type RoomListResponse, type RoomReportResponse,
  type RoomStatus, type RoomStatusResponse, type SaveRoomAnswersRequest,
} from "@cave/contracts";
import { digestOpaqueToken } from "../auth/crypto";
import type { AuthRepository } from "../auth/repository";
import { AuthServiceError } from "../auth/service";
import type { AccountPreferencesRepository } from "../account-preferences/repository";
import { newInvitationToken, newRoomId, type RoomCipher } from "./crypto";
import type { RoomReportProvider } from "./report-provider";
import { insufficientReport, safetyPause, validateRoomReport } from "./report-provider";
import type { RoomRepository, RoomRow } from "./repository";

const DAY = 86_400_000;
type AuthAccess = Pick<AuthRepository, "findSessionByAccessDigest" | "findAccountById">;
type Dependencies = { auth: AuthAccess; preferences: Pick<AccountPreferencesRepository, "get">; rooms: RoomRepository; cipher: RoomCipher; reportProvider: RoomReportProvider; creatorAccountIds: ReadonlySet<string>; now?: () => number };

export function createRoomService({ auth, preferences, rooms, cipher, reportProvider, creatorAccountIds, now = Date.now }: Dependencies) {
  async function accountFor(token: string, requireAdult = true) {
    const session = await auth.findSessionByAccessDigest(await digestOpaqueToken(token));
    if (!session || session.revokedAt || Date.parse(session.accessExpiresAt) <= now()) throw new AuthServiceError("AUTH_UNAUTHORIZED", 401);
    const account = await auth.findAccountById(session.accountId);
    if (!account) throw new AuthServiceError("AUTH_UNAUTHORIZED", 401);
    if (requireAdult && !(await preferences.get(account.id)).ageConfirmed) throw new AuthServiceError("ROOM_ADULT_REQUIRED", 403);
    return account;
  }
  async function visible(id: string, accountId: string): Promise<{ row: RoomRow; role: "owner" | "invitee" }> {
    const row = await rooms.get(id);
    if (!row || Date.parse(row.expires_at) <= now()) throw new AuthServiceError("ROOM_NOT_FOUND", 404);
    if (row.owner_account_id === accountId) return { row, role: "owner" };
    if (row.invitee_account_id === accountId && row.joined_at) return { row, role: "invitee" };
    throw new AuthServiceError("ROOM_NOT_FOUND", 404);
  }
  function status(row: RoomRow, role: "owner" | "invitee"): RoomStatus {
    return {
      id: row.id, scenario: row.scenario, role, partnerJoined: role === "owner" ? row.joined_at !== null : true,
      ownCompleted: (role === "owner" ? row.owner_completed_at : row.invitee_completed_at) !== null,
      partnerCompleted: (role === "owner" ? row.invitee_completed_at : row.owner_completed_at) !== null,
      reportStatus: row.report_status, expiresAt: row.expires_at,
    };
  }
  async function response(id: string, accountId: string, requestId: string): Promise<RoomStatusResponse> {
    const { row, role } = await visible(id, accountId);
    const encrypted = role === "owner" ? row.owner_answers_ciphertext : row.invitee_answers_ciphertext;
    const ownAnswers = encrypted ? RoomAnswersSchema.parse(await cipher.decrypt(id, `${role}-answers`, encrypted)) : null;
    return { contractVersion: "1", requestId, room: status(row, role), ownAnswers };
  }
  return {
    async create(token: string, input: CreateRoomRequest): Promise<CreateRoomResponse> {
      const account = await accountFor(token);
      if (!creatorAccountIds.has(account.id)) throw new AuthServiceError("ROOM_BETA_RESTRICTED", 403);
      const id = newRoomId();
      const invitationToken = newInvitationToken();
      const nowMs = now();
      const nowIso = new Date(nowMs).toISOString();
      const invitationExpiresAt = new Date(nowMs + 7 * DAY).toISOString();
      const expiresAt = new Date(nowMs + 30 * DAY).toISOString();
      await rooms.create({ id, scenario: input.scenario, ownerId: account.id,
        invitationDigest: await digestOpaqueToken(invitationToken),
        invitationExpiresAt, expiresAt, now: nowIso });
      const row = await rooms.get(id);
      if (!row) throw new AuthServiceError("INTERNAL_ERROR", 500);
      return { contractVersion: "1", requestId: input.requestId, room: status(row, "owner"), invitationToken, invitationExpiresAt };
    },
    async join(token: string, input: JoinRoomRequest): Promise<RoomStatusResponse> {
      const account = await accountFor(token);
      const digest = await digestOpaqueToken(input.invitationToken);
      const invitation = await rooms.findByInvitationDigest(digest);
      if (!invitation) throw new AuthServiceError("ROOM_INVITATION_INVALID", 400);
      const id = invitation.id;
      const joined = await rooms.join(id, account.id,
        digest, new Date(now()).toISOString());
      if (!joined) {
        const row = await rooms.get(id);
        if (row?.invitee_account_id === account.id && row.joined_at && row.invitation_digest === digest && Date.parse(row.expires_at) > now()) return response(id, account.id, input.requestId);
        throw new AuthServiceError("ROOM_INVITATION_INVALID", 400);
      }
      return response(id, account.id, input.requestId);
    },
    async reissueInvitation(token: string, id: string, requestId: string): Promise<ReissueRoomInvitationResponse> {
      const account = await accountFor(token);
      const { row, role } = await visible(id, account.id);
      if (role !== "owner" || row.joined_at) throw new AuthServiceError("ROOM_CONFLICT", 409);
      const invitationToken = newInvitationToken();
      const nowMs = now();
      const invitationExpiresAt = new Date(Math.min(nowMs + 7 * DAY, Date.parse(row.expires_at))).toISOString();
      if (!await rooms.reissueInvitation(id, account.id, await digestOpaqueToken(invitationToken), invitationExpiresAt, new Date(nowMs).toISOString())) {
        throw new AuthServiceError("ROOM_CONFLICT", 409);
      }
      return { contractVersion: "1", requestId, roomId: id, invitationToken, invitationExpiresAt };
    },
    async get(token: string, id: string, requestId: string): Promise<RoomStatusResponse> {
      const account = await accountFor(token);
      return response(id, account.id, requestId);
    },
    async list(token: string, requestId: string): Promise<RoomListResponse> {
      const account = await accountFor(token);
      const rows = await rooms.listForAccount(account.id, new Date(now()).toISOString(), 50);
      const visibleRows = await Promise.all(rows.map(async row => {
        const role = row.owner_account_id === account.id ? "owner" : "invitee";
        const encrypted = role === "owner" ? row.owner_answers_ciphertext : row.invitee_answers_ciphertext;
        const ownAnswers = encrypted ? RoomAnswersSchema.parse(await cipher.decrypt(row.id, `${role}-answers`, encrypted)) : null;
        return { room: status(row, role), ownAnswers };
      }));
      return { contractVersion: "1", requestId, rooms: visibleRows };
    },
    async save(token: string, id: string, input: SaveRoomAnswersRequest): Promise<RoomStatusResponse> {
      const account = await accountFor(token);
      const { role } = await visible(id, account.id);
      const encrypted = await cipher.encrypt(id, `${role}-answers`, input.answers);
      if (!await rooms.save(id, account.id, role, encrypted, new Date(now()).toISOString())) throw new AuthServiceError("ROOM_CONFLICT", 409);
      return response(id, account.id, input.requestId);
    },
    async complete(token: string, id: string, input: CompleteRoomAnswersRequest): Promise<RoomStatusResponse> {
      const account = await accountFor(token);
      const { row, role } = await visible(id, account.id);
      if ((role === "owner" ? row.owner_completed_at : row.invitee_completed_at) === null
        && !await rooms.complete(id, account.id, role, new Date(now()).toISOString())) throw new AuthServiceError("ROOM_NOT_READY", 409);
      return response(id, account.id, input.requestId);
    },
    async readReport(token: string, id: string, requestId: string): Promise<RoomReportResponse> {
      const account = await accountFor(token);
      const { row } = await visible(id, account.id);
      if (!row.report_ciphertext || !["ready", "paused", "insufficient"].includes(row.report_status)) {
        throw new AuthServiceError("ROOM_NOT_READY", 409);
      }
      return { contractVersion: "1", requestId, roomId: id,
        report: RoomReportSchema.parse(await cipher.decrypt(id, "report", row.report_ciphertext)) };
    },
    async report(token: string, id: string, requestId: string): Promise<RoomReportResponse> {
      const account = await accountFor(token);
      let { row } = await visible(id, account.id);
      if (!row.owner_completed_at || !row.invitee_completed_at || !row.joined_at) throw new AuthServiceError("ROOM_NOT_READY", 409);
      if (row.report_ciphertext && (row.report_status === "ready" || row.report_status === "paused" || row.report_status === "insufficient")) {
        return { contractVersion: "1", requestId, roomId: id, report: RoomReportSchema.parse(await cipher.decrypt(id, "report", row.report_ciphertext)) };
      }
      const claim = newRoomId();
      if (!await rooms.claim(id, claim, new Date(now()).toISOString(), new Date(now() + 120_000).toISOString())) {
        throw new AuthServiceError("ROOM_CONFLICT", 409);
      }
      try {
        // Re-read after the atomic claim. A concurrent termination makes the claim disappear.
        row = (await visible(id, account.id)).row;
        if (row.generation_claim !== claim || !row.owner_answers_ciphertext || !row.invitee_answers_ciphertext) throw new AuthServiceError("ROOM_CONFLICT", 409);
        const ownerAnswers: RoomAnswers = RoomAnswersSchema.parse(await cipher.decrypt(id, "owner-answers", row.owner_answers_ciphertext));
        const inviteeAnswers: RoomAnswers = RoomAnswersSchema.parse(await cipher.decrypt(id, "invitee-answers", row.invitee_answers_ciphertext));
        const reportInput = { scenario: row.scenario, ownerAnswers, inviteeAnswers };
        const pause = safetyPause(reportInput) ?? insufficientReport(reportInput);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30_000);
        let report;
        try { report = validateRoomReport(pause ?? await reportProvider.generate(reportInput, controller.signal), reportInput); }
        finally { clearTimeout(timeout); }
        const encrypted = await cipher.encrypt(id, "report", report);
        if (!await rooms.finish(id, claim, encrypted, report.status, new Date(now()).toISOString())) throw new AuthServiceError("ROOM_CONFLICT", 409);
        return { contractVersion: "1", requestId, roomId: id, report };
      } catch (error) {
        await rooms.release(id, claim);
        throw error;
      }
    },
    async terminate(token: string, id: string): Promise<void> {
      const account = await accountFor(token, false);
      if (!await rooms.terminate(id, account.id)) throw new AuthServiceError("ROOM_NOT_FOUND", 404);
    },
  };
}
export type RoomService = ReturnType<typeof createRoomService>;

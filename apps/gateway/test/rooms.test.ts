import { describe, expect, it, vi } from "vitest";
import { createRoomCipher } from "../src/rooms/crypto";
import { createRoomReportInput, createRoomReportProvider, safetyPause, validateRoomReport, type RoomReportProvider } from "../src/rooms/report-provider";
import { createRoomService } from "../src/rooms/service";
import type { RoomRepository, RoomRow } from "../src/rooms/repository";
import { digestOpaqueToken } from "../src/auth/crypto";
import type { AuthRepository } from "../src/auth/repository";
import sampleLedger from "../../../docs/calibration/paired-room/two-stage/example-pause-ledger.json";
import samplePlan from "../../../docs/calibration/paired-room/two-stage/example-pause-plan.json";
import sampleReport from "../../../docs/calibration/paired-room/two-stage/example-pause-report.json";

const requestId = "6cc380dd-f5b0-4e39-bac4-54fa9b4abcc1";
const answers = ["自己的界限", "希望慢一点", "可以暂停", "先确认感受"] as const;
const secret = "ab".repeat(32);
const readyReport = (scenarioId: "pause" | "adjust" | "first-overnight") => ({
  version: "paired-report-v0.2" as const, scenarioId, status: "ready" as const,
  sections: {
    commonAndDifferences: { text: "双方都提供了可以讨论的内容，但各自关注的事情并不完全相同，还需要继续确认。", evidence: ["A.expectation", "B.expectation"] as ["A.expectation", "B.expectation"] },
    adviceForBoth: { text: "双方可以在愿意时确认各自的关注点，讨论过程中保留暂停和不继续的选择。", evidence: ["A.concern", "B.concern"] as ["A.concern", "B.concern"] },
    nextSteps: { text: "若双方愿意，可先确认下一次交流的时间；具体要讨论的内容仍由双方另行决定。", evidence: ["A.response_next_step", "B.response_next_step"] as ["A.response_next_step", "B.response_next_step"] },
  },
});

async function harness(overrideProvider?: RoomReportProvider) {
  let current = Date.parse("2026-09-29T00:00:00.000Z");
  const adult = [true, true, true];
  const rows = new Map<string, RoomRow>();
  const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  const tokens = ["cave_at_" + "a".repeat(43), "cave_at_" + "b".repeat(43), "cave_at_" + "c".repeat(43)];
  const digests = await Promise.all(tokens.map(digestOpaqueToken));
  const auth = {
    async findSessionByAccessDigest(digest: string) {
      const index = digests.indexOf(digest);
      return index < 0 ? null : { id: crypto.randomUUID(), accountId: ids[index], accessDigest: digest,
        accessExpiresAt: new Date(current + 60_000).toISOString(), refreshDigest: "", refreshExpiresAt: "",
        createdAt: "", lastSeenAt: "" };
    },
    async findAccountById(id: string) {
      const index = ids.indexOf(id);
      return index < 0 ? null : { id, emailLookup: `email-digest-${index}`, emailKeyVersion: 1, createdAt: "" };
    },
  } as Pick<AuthRepository, "findSessionByAccessDigest" | "findAccountById">;
  const rooms: RoomRepository = {
    async create(input) { rows.set(input.id, {
      id: input.id, scenario: input.scenario, owner_account_id: input.ownerId, invitee_account_id: null, invitation_digest: input.invitationDigest,
      invitation_expires_at: input.invitationExpiresAt, expires_at: input.expiresAt, joined_at: null,
      owner_answers_ciphertext: null, invitee_answers_ciphertext: null, owner_completed_at: null,
      invitee_completed_at: null, report_ciphertext: null, report_status: "waiting", generation_claim: null, generation_lease_until: null,
    }); },
    async get(id) { return rows.get(id) ?? null; },
    async listForAccount(accountId, now, limit) { return [...rows.values()].filter(row => row.expires_at > now && (row.owner_account_id === accountId || (row.invitee_account_id === accountId && !!row.joined_at))).slice(0, limit); },
    async findByInvitationDigest(digest) { return [...rows.values()].find(row => row.invitation_digest === digest) ?? null; },
    async join(id, accountId, digest, now) {
      const row = rows.get(id);
      if (!row || row.owner_account_id === accountId || row.joined_at || row.invitation_digest !== digest
        || row.invitation_expires_at <= now || row.expires_at <= now
        || (row.invitee_account_id && row.invitee_account_id !== accountId)) return false;
      row.invitee_account_id = accountId; row.joined_at = now; return true;
    },
    async reissueInvitation(id, ownerId, digest, expiresAt, now) {
      const row = rows.get(id);
      if (!row || row.owner_account_id !== ownerId || row.joined_at || row.expires_at <= now) return false;
      row.invitation_digest = digest; row.invitation_expires_at = expiresAt; return true;
    },
    async save(id, accountId, role, ciphertext, now) {
      const row = rows.get(id);
      if (!row || row.expires_at <= now || (role === "owner" ? row.owner_account_id : row.invitee_account_id) !== accountId
        || (role === "invitee" && !row.joined_at)) return false;
      row[role === "owner" ? "owner_answers_ciphertext" : "invitee_answers_ciphertext"] = ciphertext;
      row[role === "owner" ? "owner_completed_at" : "invitee_completed_at"] = null;
      row.report_ciphertext = null; row.report_status = "waiting"; row.generation_claim = null; row.generation_lease_until = null;
      return true;
    },
    async complete(id, accountId, role, now) {
      const row = rows.get(id);
      if (!row || row.expires_at <= now || row.report_status !== "waiting" || (role === "owner" ? row.owner_account_id : row.invitee_account_id) !== accountId
        || (role === "invitee" && !row.joined_at) || !(role === "owner" ? row.owner_answers_ciphertext : row.invitee_answers_ciphertext)
        || (role === "owner" ? row.owner_completed_at : row.invitee_completed_at)) return false;
      row[role === "owner" ? "owner_completed_at" : "invitee_completed_at"] = now; return true;
    },
    async claim(id, claim, now, lease) {
      const row = rows.get(id);
      if (!row || row.expires_at <= now || !row.joined_at || !row.owner_completed_at || !row.invitee_completed_at
        || (row.report_status !== "waiting" && !(row.report_status === "generating" && row.generation_lease_until! < now))) return false;
      row.report_status = "generating"; row.generation_claim = claim; row.generation_lease_until = lease; return true;
    },
    async finish(id, claim, ciphertext, status, now, deadlineMs) {
      const row = rows.get(id);
      if (!row || row.generation_claim !== claim || row.expires_at <= now || !row.owner_completed_at || !row.invitee_completed_at || Date.now() >= deadlineMs) return false;
      row.report_status = status; row.report_ciphertext = ciphertext; row.generation_claim = null; return true;
    },
    async release(id, claim) { const row = rows.get(id); if (row?.generation_claim === claim) { row.report_status = "waiting"; row.generation_claim = null; } },
    async terminate(id, accountId) { const row = rows.get(id); if (!row || (row.owner_account_id !== accountId && !(row.invitee_account_id === accountId && row.joined_at))) return false; rows.delete(id); return true; },
    async cleanupExpired(now) { for (const [id, row] of rows) if (row.expires_at <= now) rows.delete(id); return false; },
  };
  const generate = vi.fn(async (input: { scenarioId: "pause" | "adjust" | "first-overnight" }) => readyReport(input.scenarioId));
  const preferences = { async get(accountId: string) { return { ageConfirmed: adult[ids.indexOf(accountId)] ?? false, addressPreference: null, updatedAt: null, revision: 0 }; } };
  const creators = new Set([ids[0]]);
  const service = createRoomService({ auth, preferences, rooms, cipher: createRoomCipher(secret), reportProvider: overrideProvider ?? { generate }, creatorAccountIds: creators, now: () => current });
  return { service, rows, tokens, generate, adult, creators, advance: (days: number) => { current += days * 86_400_000; } };
}

describe("two-person rooms", () => {
  it("keeps drafts private, requires both explicit completions, and generates once", async () => {
    const { service, rows, tokens, generate } = await harness();
    const created = await service.create(tokens[0], { contractVersion: "1", requestId, scenario: "pause", adultConfirmed: true });
    const id = created.room.id;
    await service.save(tokens[0], id, { contractVersion: "1", requestId, answers: [...answers] });
    await expect(service.report(tokens[0], id, requestId)).rejects.toMatchObject({ code: "ROOM_NOT_READY" });
    await expect(service.readReport(tokens[0], id, requestId)).rejects.toMatchObject({ code: "ROOM_NOT_READY" });
    await service.join(tokens[1], { contractVersion: "1", requestId, invitationToken: created.invitationToken, adultConfirmed: true });
    const guest = await service.get(tokens[1], id, requestId);
    expect(guest.ownAnswers).toBeNull();
    expect(JSON.stringify(guest)).not.toContain(answers[0]);
    expect(JSON.stringify([...rows.values()])).not.toContain(answers[0]);
    await expect(service.get(tokens[2], id, requestId)).rejects.toMatchObject({ code: "ROOM_NOT_FOUND" });
    await service.save(tokens[1], id, { contractVersion: "1", requestId, answers: ["另一人", "愿意", "保持边界", "再沟通"] });
    await service.complete(tokens[0], id, { contractVersion: "1", requestId, authorizeSharedReport: true });
    await expect(service.report(tokens[0], id, requestId)).rejects.toMatchObject({ code: "ROOM_NOT_READY" });
    await service.complete(tokens[1], id, { contractVersion: "1", requestId, authorizeSharedReport: true });
    const simultaneous = await Promise.allSettled([service.report(tokens[0], id, requestId), service.report(tokens[1], id, requestId)]);
    expect(simultaneous.some(result => result.status === "fulfilled")).toBe(true);
    expect((await service.report(tokens[1], id, requestId)).report.status).toBe("ready");
    expect(generate).toHaveBeenCalledTimes(1);
    expect((await service.readReport(tokens[1], id, requestId)).report.status).toBe("ready");
    expect(JSON.stringify(await service.readReport(tokens[1], id, requestId))).not.toContain("evidence");
    expect(generate).toHaveBeenCalledTimes(1);
    await expect(service.readReport(tokens[2], id, requestId)).rejects.toMatchObject({ code: "ROOM_NOT_FOUND" });
    await service.save(tokens[0], id, { contractVersion: "1", requestId, answers: [...answers] });
    await expect(service.report(tokens[1], id, requestId)).rejects.toMatchObject({ code: "ROOM_NOT_READY" });
    await service.complete(tokens[0], id, { contractVersion: "1", requestId, authorizeSharedReport: true });
    await service.report(tokens[1], id, requestId);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("rejects wrong identity or token, deletes both sides, and expires invite and room", async () => {
    const { service, rows, tokens, advance } = await harness();
    const created = await service.create(tokens[0], { contractVersion: "1", requestId, scenario: "adjust", adultConfirmed: true });
    await expect(service.join(tokens[0], { contractVersion: "1", requestId, invitationToken: created.invitationToken, adultConfirmed: true })).rejects.toMatchObject({ code: "ROOM_INVITATION_INVALID" });
    await expect(service.join(tokens[1], { contractVersion: "1", requestId, invitationToken: "cave_ri_" + "x".repeat(43), adultConfirmed: true })).rejects.toMatchObject({ code: "ROOM_INVITATION_INVALID" });
    advance(8);
    await expect(service.join(tokens[1], { contractVersion: "1", requestId, invitationToken: created.invitationToken, adultConfirmed: true })).rejects.toMatchObject({ code: "ROOM_INVITATION_INVALID" });
    const next = await service.create(tokens[0], { contractVersion: "1", requestId, scenario: "first-overnight", adultConfirmed: true });
    await service.join(tokens[1], { contractVersion: "1", requestId, invitationToken: next.invitationToken, adultConfirmed: true });
    await service.terminate(tokens[1], next.room.id);
    expect(rows.has(next.room.id)).toBe(false);
    await expect(service.get(tokens[0], next.room.id, requestId)).rejects.toMatchObject({ code: "ROOM_NOT_FOUND" });
    advance(31);
    await expect(service.get(tokens[0], created.room.id, requestId)).rejects.toMatchObject({ code: "ROOM_NOT_FOUND" });
  });

  it("lets only an unjoined room owner reissue an invitation and revokes the old token", async () => {
    const { service, tokens } = await harness();
    const created = await service.create(tokens[0], { contractVersion: "1", requestId, scenario: "pause", adultConfirmed: true });
    await expect(service.reissueInvitation(tokens[2], created.room.id, requestId)).rejects.toMatchObject({ code: "ROOM_NOT_FOUND" });
    const renewed = await service.reissueInvitation(tokens[0], created.room.id, requestId);
    await expect(service.join(tokens[1], { contractVersion: "1", requestId, invitationToken: created.invitationToken, adultConfirmed: true })).rejects.toMatchObject({ code: "ROOM_INVITATION_INVALID" });
    await service.join(tokens[1], { contractVersion: "1", requestId, invitationToken: renewed.invitationToken, adultConfirmed: true });
    await expect(service.reissueInvitation(tokens[0], created.room.id, requestId)).rejects.toMatchObject({ code: "ROOM_CONFLICT" });
  });

  it("uses persisted account age confirmation and lists only the caller's answers", async () => {
    const { service, tokens, adult } = await harness();
    adult[0] = false;
    await expect(service.create(tokens[0], { contractVersion: "1", requestId, scenario: "pause", adultConfirmed: true })).rejects.toMatchObject({ code: "ROOM_ADULT_REQUIRED" });
    adult[0] = true;
    const created = await service.create(tokens[0], { contractVersion: "1", requestId, scenario: "pause", adultConfirmed: true });
    await service.save(tokens[0], created.room.id, { contractVersion: "1", requestId, answers: [...answers] });
    adult[1] = false;
    await expect(service.join(tokens[1], { contractVersion: "1", requestId, invitationToken: created.invitationToken, adultConfirmed: true })).rejects.toMatchObject({ code: "ROOM_ADULT_REQUIRED" });
    adult[1] = true;
    await service.join(tokens[1], { contractVersion: "1", requestId, invitationToken: created.invitationToken, adultConfirmed: true });
    const guestList = await service.list(tokens[1], requestId);
    expect(guestList.rooms).toHaveLength(1);
    expect(guestList.rooms[0]?.ownAnswers).toBeNull();
    expect(JSON.stringify(guestList)).not.toContain(answers[0]);
    expect((await service.list(tokens[2], requestId)).rooms).toEqual([]);
    adult[1] = false;
    await expect(service.get(tokens[1], created.room.id, requestId)).rejects.toMatchObject({ code: "ROOM_ADULT_REQUIRED" });
    await expect(service.list(tokens[1], requestId)).rejects.toMatchObject({ code: "ROOM_ADULT_REQUIRED" });
    await expect(service.report(tokens[1], created.room.id, requestId)).rejects.toMatchObject({ code: "ROOM_ADULT_REQUIRED" });
    await expect(service.readReport(tokens[1], created.room.id, requestId)).rejects.toMatchObject({ code: "ROOM_ADULT_REQUIRED" });
    await service.terminate(tokens[1], created.room.id);
    await expect(service.get(tokens[0], created.room.id, requestId)).rejects.toMatchObject({ code: "ROOM_NOT_FOUND" });
  });

  it("restricts creation to beta account IDs while an invited account can join", async () => {
    const { service, tokens } = await harness();
    await expect(service.create(tokens[1], { contractVersion: "1", requestId, scenario: "pause", adultConfirmed: true })).rejects.toMatchObject({ code: "ROOM_BETA_RESTRICTED" });
    const created = await service.create(tokens[0], { contractVersion: "1", requestId, scenario: "pause", adultConfirmed: true });
    expect((await service.join(tokens[1], { contractVersion: "1", requestId, invitationToken: created.invitationToken, adultConfirmed: true })).room.role).toBe("invitee");
  });

  it("allows every authenticated adult to create when the creator policy is open", async () => {
    const { service, tokens, creators, adult } = await harness();
    creators.add("*");
    expect((await service.create(tokens[1], { contractVersion: "1", requestId, scenario: "pause", adultConfirmed: true })).room.role).toBe("owner");
    adult[2] = false;
    await expect(service.create(tokens[2], { contractVersion: "1", requestId, scenario: "pause", adultConfirmed: true })).rejects.toMatchObject({ code: "ROOM_ADULT_REQUIRED" });
  });

  it("pauses safely before calling the report provider", async () => {
    const { service, tokens, generate } = await harness();
    const created = await service.create(tokens[0], { contractVersion: "1", requestId, scenario: "pause", adultConfirmed: true });
    await service.join(tokens[1], { contractVersion: "1", requestId, invitationToken: created.invitationToken, adultConfirmed: true });
    await service.save(tokens[0], created.room.id, { contractVersion: "1", requestId, answers: ["受到威胁", "希望慢一点", "可以暂停", "先确认感受"] });
    await service.save(tokens[1], created.room.id, { contractVersion: "1", requestId, answers: [...answers] });
    await service.complete(tokens[0], created.room.id, { contractVersion: "1", requestId, authorizeSharedReport: true });
    await service.complete(tokens[1], created.room.id, { contractVersion: "1", requestId, authorizeSharedReport: true });
    const result = await service.report(tokens[0], created.room.id, requestId);
    expect(result.report.status).toBe("paused");
    expect(generate).not.toHaveBeenCalled();
  });

  it("returns insufficient when either person supplies no answer", async () => {
    const { service, tokens, generate } = await harness();
    const created = await service.create(tokens[0], { contractVersion: "1", requestId, scenario: "adjust", adultConfirmed: true });
    await service.join(tokens[1], { contractVersion: "1", requestId, invitationToken: created.invitationToken, adultConfirmed: true });
    await service.save(tokens[0], created.room.id, { contractVersion: "1", requestId, answers: ["一项", "", "", ""] });
    await service.save(tokens[1], created.room.id, { contractVersion: "1", requestId, answers: ["", "", "", ""] });
    await service.complete(tokens[0], created.room.id, { contractVersion: "1", requestId, authorizeSharedReport: true });
    await service.complete(tokens[1], created.room.id, { contractVersion: "1", requestId, authorizeSharedReport: true });
    expect((await service.report(tokens[0], created.room.id, requestId)).report.status).toBe("insufficient");
    expect(generate).not.toHaveBeenCalled();
  });

  it.each([
    ["coercion-after-pause", "pause", ["希望说停就停。", "我说停后对方还要求再试一下，说不继续就是不爱。", "我不想继续触碰。", "我想先离开。"], ["希望能继续。", "怕被拒绝。", "我想再劝一次。", "想让对方改变主意。"]],
    ["violence-blocked-exit", "first-overnight", ["我想回家。", "对方打了我，还把门堵住不让我走。", "我要离开。", "不知道怎么安全离开。"], ["想一起过夜。", "不想对方走。", "", ""]],
    ["cannot-refuse", "adjust", ["想保持距离。", "我怕说不就会被惩罚，所以不敢拒绝。", "暂时不想被碰。", "不想一起商量。"], ["想更靠近。", "", "", "想一起决定。"]],
  ] as const)("pauses calibration safety case %s without a model call", async (_id, scenario, owner, guest) => {
    const { service, tokens, generate } = await harness();
    const created = await service.create(tokens[0], { contractVersion: "1", requestId, scenario, adultConfirmed: true });
    await service.join(tokens[1], { contractVersion: "1", requestId, invitationToken: created.invitationToken, adultConfirmed: true });
    await service.save(tokens[0], created.room.id, { contractVersion: "1", requestId, answers: [...owner] });
    await service.save(tokens[1], created.room.id, { contractVersion: "1", requestId, answers: [...guest] });
    await service.complete(tokens[0], created.room.id, { contractVersion: "1", requestId, authorizeSharedReport: true });
    await service.complete(tokens[1], created.room.id, { contractVersion: "1", requestId, authorizeSharedReport: true });
    expect((await service.report(tokens[0], created.room.id, requestId)).report.status).toBe("paused");
    expect(generate).not.toHaveBeenCalled();
  });

  it("does not pause ordinary boundary setting", () => {
    expect(safetyPause(createRoomReportInput("pause",
      ["暂停就是立刻停止触碰和追问。", "我怕暂停后还要解释原因。", "我说停就请先停，给我一小时独处。", "希望先听到好，我们停。"],
      ["暂停就是当下停止。", "我担心不知道是否还能再谈。", "听到停会停止触碰。", "之后等对方提出。"],
    ))).toBeNull();
  });

  it("drops a report that copies a private answer verbatim", () => {
    const input = createRoomReportInput("pause", ["我希望今晚单独回家", "担心对方误会", "不想触碰", "明天再谈"],
      ["希望暂停", "担心误会", "尊重暂停", "明天再问"]);
    const report = readyReport("pause");
    report.sections.commonAndDifferences.text = "双方都希望平静讨论，但我希望今晚单独回家的想法需要尊重，也要确认另一方的安排。";
    expect(() => validateRoomReport(report, input)).toThrow("verbatim-room-report");
  });

  it("cannot restore a report after termination during generation", async () => {
    let unblock!: () => void;
    let started!: () => void;
    const began = new Promise<void>(resolve => { started = resolve; });
    const hold = new Promise<void>(resolve => { unblock = resolve; });
    const { service, rows, tokens } = await harness({ generate: async input => {
      started(); await hold;
      return { version: "paired-report-v0.2", scenarioId: input.scenarioId, status: "insufficient",
        message: "目前没有足够的双方信息生成有依据的共同报告。可以各自补充、跳过，或结束本次填写。" };
    } });
    const created = await service.create(tokens[0], { contractVersion: "1", requestId, scenario: "pause", adultConfirmed: true });
    await service.join(tokens[1], { contractVersion: "1", requestId, invitationToken: created.invitationToken, adultConfirmed: true });
    await service.save(tokens[0], created.room.id, { contractVersion: "1", requestId, answers: [...answers] });
    await service.save(tokens[1], created.room.id, { contractVersion: "1", requestId, answers: [...answers] });
    await service.complete(tokens[0], created.room.id, { contractVersion: "1", requestId, authorizeSharedReport: true });
    await service.complete(tokens[1], created.room.id, { contractVersion: "1", requestId, authorizeSharedReport: true });
    const running = service.report(tokens[0], created.room.id, requestId);
    await began;
    await service.terminate(tokens[1], created.room.id);
    unblock();
    await expect(running).rejects.toMatchObject({ code: "ROOM_CONFLICT" });
    expect(rows.has(created.room.id)).toBe(false);
  });

  it("builds the private input shape and fails when the model is unavailable", async () => {
    const input = createRoomReportInput("pause", ["希望停下", "担心误会", "", "明天再谈"],
      ["愿意暂停", "想确认时间", "会停下", ""]);
    expect(input).toEqual({
      scenarioId: "pause", consent: { A: true, B: true },
      answers: {
        A: { expectation: "希望停下", concern: "担心误会", boundary: null, response_next_step: "明天再谈" },
        B: { expectation: "愿意暂停", concern: "想确认时间", boundary: "会停下", response_next_step: null },
      },
    });
    await expect(createRoomReportProvider().generate(input, new AbortController().signal)).rejects.toMatchObject({ code: "MODEL_UNAVAILABLE" });
  });

  it("releases the generation claim and stores no invented report when the model is unavailable", async () => {
    const { service, rows, tokens } = await harness(createRoomReportProvider());
    const created = await service.create(tokens[0], { contractVersion: "1", requestId, scenario: "pause", adultConfirmed: true });
    await service.join(tokens[1], { contractVersion: "1", requestId, invitationToken: created.invitationToken, adultConfirmed: true });
    await service.save(tokens[0], created.room.id, { contractVersion: "1", requestId, answers: [...answers] });
    await service.save(tokens[1], created.room.id, { contractVersion: "1", requestId, answers: [...answers] });
    await service.complete(tokens[0], created.room.id, { contractVersion: "1", requestId, authorizeSharedReport: true });
    await service.complete(tokens[1], created.room.id, { contractVersion: "1", requestId, authorizeSharedReport: true });
    await expect(service.report(tokens[0], created.room.id, requestId)).rejects.toMatchObject({ code: "MODEL_UNAVAILABLE", status: 503 });
    expect(rows.get(created.room.id)?.report_ciphertext).toBeNull();
    expect(rows.get(created.room.id)?.report_status).toBe("waiting");
    await expect(service.readReport(tokens[1], created.room.id, requestId)).rejects.toMatchObject({ code: "ROOM_NOT_READY" });
  });

  it("does not persist a validated ledger or rejected second-stage plan", async () => {
    let calls = 0;
    const provider = createRoomReportProvider(async () => {
      calls += 1;
      return calls === 1 ? sampleLedger : { ...samplePlan, ledgerSha256: "0".repeat(64) };
    });
    const { service, rows, tokens } = await harness(provider);
    const created = await service.create(tokens[0], { contractVersion: "1", requestId, scenario: "pause", adultConfirmed: true });
    await service.join(tokens[1], { contractVersion: "1", requestId, invitationToken: created.invitationToken, adultConfirmed: true });
    await service.save(tokens[0], created.room.id, { contractVersion: "1", requestId, answers: [
      "暂停就是立刻停止触碰和追问。", "我怕暂停后还要解释原因。", "我说停就请先停，给我一小时独处；是否再谈由我另行提出。", "希望先听到好，我们停，不要问为什么。",
    ] });
    await service.save(tokens[1], created.room.id, { contractVersion: "1", requestId, answers: [
      "暂停就是当下停止，之后不急着恢复。", "我担心不知道是否还能再谈。", "听到停会停止触碰；不会自行恢复。", "我可以先说好，之后等对方提出，再问是否愿意聊。",
    ] });
    await service.complete(tokens[0], created.room.id, { contractVersion: "1", requestId, authorizeSharedReport: true });
    await service.complete(tokens[1], created.room.id, { contractVersion: "1", requestId, authorizeSharedReport: true });
    await expect(service.report(tokens[0], created.room.id, requestId)).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT", status: 502 });
    expect(calls).toBe(2);
    expect(rows.get(created.room.id)?.report_ciphertext).toBeNull();
    expect(rows.get(created.room.id)?.report_status).toBe("waiting");
    await expect(service.readReport(tokens[1], created.room.id, requestId)).rejects.toMatchObject({ code: "ROOM_NOT_READY" });
  });

  it("stores only the final encrypted report and reuses it on a repeated request", async () => {
    let calls = 0;
    const provider = createRoomReportProvider(async () => { calls += 1; return calls === 1 ? sampleLedger : samplePlan; });
    const { service, rows, tokens } = await harness(provider);
    const created = await service.create(tokens[0], { contractVersion: "1", requestId, scenario: "pause", adultConfirmed: true });
    await service.join(tokens[1], { contractVersion: "1", requestId, invitationToken: created.invitationToken, adultConfirmed: true });
    await service.save(tokens[0], created.room.id, { contractVersion: "1", requestId, answers: [
      "暂停就是立刻停止触碰和追问。", "我怕暂停后还要解释原因。", "我说停就请先停，给我一小时独处；是否再谈由我另行提出。", "希望先听到好，我们停，不要问为什么。",
    ] });
    await service.save(tokens[1], created.room.id, { contractVersion: "1", requestId, answers: [
      "暂停就是当下停止，之后不急着恢复。", "我担心不知道是否还能再谈。", "听到停会停止触碰；不会自行恢复。", "我可以先说好，之后等对方提出，再问是否愿意聊。",
    ] });
    await service.complete(tokens[0], created.room.id, { contractVersion: "1", requestId, authorizeSharedReport: true });
    await service.complete(tokens[1], created.room.id, { contractVersion: "1", requestId, authorizeSharedReport: true });
    const first = await service.report(tokens[0], created.room.id, requestId);
    expect(first.report.status).toBe("ready");
    if (first.report.status !== "ready") throw new Error("expected a ready report");
    expect(first.report.sections.commonAndDifferences).toEqual({ text: sampleReport.sections.commonAndDifferences.text });
    expect(JSON.stringify(first)).not.toMatch(/sourceSpan|ledgerSha256|evidence/u);
    expect(await service.report(tokens[1], created.room.id, requestId)).toEqual(first);
    expect(calls).toBe(2);
    const sealed = rows.get(created.room.id)?.report_ciphertext;
    expect(sealed).toBeTruthy();
    const stored = await createRoomCipher(secret).decrypt(created.room.id, "report", sealed!);
    expect(stored).toEqual(sampleReport);
    expect(JSON.stringify(stored)).not.toMatch(/sourceSpan|ledgerSha256|report-plan/u);
  });

  it("rejects one-sided evidence and role scripts", () => {
    const input = createRoomReportInput("pause", [...answers], [...answers]);
    const oneSided = readyReport("pause");
    oneSided.sections.commonAndDifferences.evidence = ["A.expectation", "A.concern"] as ["A.expectation", "A.concern"];
    expect(() => validateRoomReport(oneSided, input)).toThrow("room-report-both-sides-required");
    const scripted = readyReport("pause");
    scripted.sections.adviceForBoth.text = "A可以说：我现在想暂停；B可以说：我会等你。双方之后再确认是否继续。";
    expect(() => validateRoomReport(scripted, input)).toThrow("unsafe-room-report");
  });

  it("rejects invented relationship meaning while allowing an explicitly cited relationship concern", () => {
    const ordinary = createRoomReportInput("pause",
      ["希望先暂停", "担心产生误会", "停止触碰", "休息后再谈"],
      ["愿意暂停", "担心不知时间", "尊重暂停", "之后再确认"]);
    const report = readyReport("pause");
    report.sections.adviceForBoth.text = "双方可共同确认暂停后的安排，避免把短暂安静理解为关系疏远，仍保留各自选择。";
    expect(() => validateRoomReport(report, ordinary)).toThrow("ungrounded-relationship-meaning");

    const explicit = createRoomReportInput("pause",
      ["希望先暂停", "担心关系会变得疏远", "停止触碰", "休息后再谈"],
      ["愿意暂停", "担心不知时间", "尊重暂停", "之后再确认"]);
    expect(validateRoomReport(report, explicit).status).toBe("ready");
  });

  it("does not mark a known re-talk initiator as unknown", () => {
    const input = createRoomReportInput("pause",
      ["希望说停就停", "担心解释太多", "是否再谈由我另行提出", "我会先独处一会儿"],
      ["愿意先暂停", "担心没有机会再聊", "会停止触碰", "之后等对方提出，再问是否愿意聊"]);
    const report = readyReport("pause");
    report.sections.nextSteps.text = "双方可以先各自休息，再谈由谁提出仍待确认；若愿意，之后再核对边界与交流时间。";
    expect(() => validateRoomReport(report, input)).toThrow("known-retalk-initiator-marked-unknown");
    report.sections.nextSteps.text = "双方可以先各自休息，由先提出暂停的一方发起再谈；届时是否继续交流仍由双方选择。";
    expect(validateRoomReport(report, input).status).toBe("ready");
  });

  it("rejects unknown acceptance of an agreed re-talk wait but preserves one-sided uncertainty", async () => {
    const agreed = createRoomReportInput("pause",
      ["希望说停就停", "担心解释太多", "是否再谈由我另行提出", "我会先独处一会儿"],
      ["愿意先暂停", "担心没有机会再聊", "会停止触碰", "之后等对方提出，再问是否愿意聊"]);
    const report = readyReport("pause");
    report.sections.nextSteps.text = "双方可以先各自休息；再谈由A另行提出，B等A提出后再问是否愿意聊。仍需确认B是否接受等待A提出。";
    expect(() => validateRoomReport(report, agreed)).toThrow("agreed-retalk-wait-marked-unknown");
    await expect(createRoomReportProvider(async () => report).generate(agreed, new AbortController().signal))
      .rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT", status: 502 });

    report.sections.nextSteps.text = "双方可以先各自休息；再谈由A另行提出，B等A提出后再问是否愿意聊。具体何时再谈仍待确认。";
    expect(validateRoomReport(report, agreed).status).toBe("ready");

    const oneSided = createRoomReportInput("pause",
      ["希望说停就停", "担心解释太多", "是否再谈由我另行提出", "我会先独处一会儿"],
      ["愿意先暂停", "担心没有机会再聊", "会停止触碰", "之后再确认是否愿意聊"]);
    report.sections.nextSteps.text = "双方可以先各自休息；A提出再谈的安排已说明，B是否接受等待A提出仍待确认。";
    expect(validateRoomReport(report, oneSided).status).toBe("ready");
  });

  it("rejects an overnight concern or response falsely attributed to both people", async () => {
    const input = createRoomReportInput("first-overnight",
      ["想一起做饭、聊天，晚上能各自休息。", "我睡眠浅，怕临时决定住下会睡不好。", "这次不想有性行为；如果疲惫，我想随时回家。", "希望对方听到我想回家时说好。可以先约好结束时间。"],
      ["想一起吃晚饭，看看能不能自然地待到第二天。", "担心提议留宿会给对方压力。", "不把过夜当作任何亲密行为的承诺；对方想回家就停。", "希望能直接知道对方是否想留宿。可以先确定晚饭，之后再问一次。"]);
    const report = readyReport("first-overnight");
    report.sections.commonAndDifferences.text = "双方都提到一起吃饭、聊天，也都在意是否留宿带来的压力，并都表示对方想回家时可停下。";
    report.sections.commonAndDifferences.evidence = ["A.expectation", "A.concern", "A.boundary", "A.response_next_step", "B.expectation", "B.concern", "B.boundary"] as ["A.expectation", "B.expectation"];
    expect(() => validateRoomReport(report, input)).toThrow("one-sided-overnight-pressure-marked-shared");
    await expect(createRoomReportProvider(async () => report).generate(input, new AbortController().signal))
      .rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT", status: 502 });

    report.sections.commonAndDifferences.text = "双方都表示对方想回家时可停下，晚饭和留宿仍可以分开确认。";
    expect(() => validateRoomReport(report, input)).toThrow("one-sided-return-response-marked-shared");

    const bothRespond = createRoomReportInput("first-overnight",
      ["想一起做饭、聊天，晚上能各自休息。", "担心留宿会给彼此压力。", "这次不想有性行为；对方想回家就停。", "可以先约好结束时间。"],
      ["想一起吃晚饭，看看能不能自然地待到第二天。", "担心提议留宿会给对方压力。", "对方想回家就停。", "可以先确定晚饭，之后再问一次。"]);
    expect(validateRoomReport(report, bothRespond).status).toBe("ready");
    report.sections.commonAndDifferences.text = "双方都在意留宿带来的压力，也希望先把晚饭安排说清楚。";
    expect(validateRoomReport(report, bothRespond).status).toBe("ready");
  });

  it("rejects an unknown touch asker only when both answers establish who asks", () => {
    const agreed = createRoomReportInput("adjust",
      ["想散步聊天，身体接触先少一点。", "担心慢一点被误会。", "现在不想拥抱；牵手也暂不确定，先问我。", "这周先一起散步。"],
      ["想多一些陪伴，一起散步也好。", "担心问太多会打断相处。", "不会在未确认前拥抱或牵手。", "我可以先提议散步，需要触碰时再问。"]);
    const report = readyReport("adjust");
    report.sections.nextSteps.text = "双方愿意时可以先一起散步；仍待确认的是牵手是否接受，以及触碰前由谁先开口更自在。";
    report.sections.nextSteps.evidence = ["A.boundary", "B.response_next_step"] as ["A.response_next_step", "B.response_next_step"];
    expect(() => validateRoomReport(report, agreed)).toThrow("known-touch-asker-marked-unknown");
    report.sections.nextSteps.text = "双方愿意时可以先一起散步；触碰前由另一方先问，牵手是否接受仍待确认。";
    expect(validateRoomReport(report, agreed).status).toBe("ready");

    const oneSided = createRoomReportInput("adjust",
      ["想散步聊天，身体接触先少一点。", "担心慢一点被误会。", "现在不想拥抱；牵手也暂不确定，先问我。", "这周先一起散步。"],
      ["想多一些陪伴，一起散步也好。", "担心问太多会打断相处。", "不会在未确认前拥抱或牵手。", "先散步，之后再商量触碰安排。"]);
    report.sections.nextSteps.text = "双方愿意时可以先一起散步；仍待确认的是牵手是否接受，以及触碰前由谁先开口更自在。";
    expect(validateRoomReport(report, oneSided).status).toBe("ready");
  });

  it.each([
    "沟通时不把过夜或回家与关系含义挂钩，只谈当晚的实际安排和双方愿意保留的选择。",
    "这次回家并不意味着拒绝关系或关系变淡，双方可以在愿意时再确认晚饭和留宿安排。",
  ])("rejects an overnight report with unsupported relationship meaning: %s", advice => {
    const input = createRoomReportInput("first-overnight",
      ["想一起做饭聊天，晚上能各自休息。", "我睡眠浅，怕临时住下会睡不好。", "这次不想有性行为；疲惫时想回家。", "希望对方听到我想回家时说好。"],
      ["想一起吃晚饭，看看能否待到第二天。", "担心提议留宿会给对方压力。", "不把过夜当作亲密行为的承诺。", "可以先定晚饭，之后再问是否留宿。"]);
    const report = readyReport("first-overnight");
    report.sections.adviceForBoth.text = advice;
    expect(() => validateRoomReport(report, input)).toThrow("ungrounded-relationship-meaning");
  });

  it("rejects a closeness report that copies a quoted user phrase or scripts a line", () => {
    const input = createRoomReportInput("adjust",
      ["想散步聊天，身体接触先少一点。", "担心慢一点被理解成迟早答应拥抱。", "现在不想拥抱，牵手也不确定。", "希望对方说可以不碰，这周先散步。"],
      ["想多一些陪伴，一起散步也好。", "担心问太多会打断相处。", "不会在未确认前拥抱或牵手。", "可以先说我们先散步，需要触碰时再问。"]);
    const report = readyReport("adjust");
    report.sections.adviceForBoth.text = "双方可以讨论散步与触碰前的确认；A 担心“慢一点”被误会，B 可说“我们先散步”。";
    expect(() => validateRoomReport(report, input)).toThrow("unsafe-room-report");
  });
});

import { z } from "zod";

const Base = { contractVersion: z.literal("1"), requestId: z.string().uuid() };
const Id = z.string().uuid();
const DateTime = z.string().datetime({ offset: true });
export const RoomScenarioSchema = z.enum(["first-overnight", "pause", "adjust"]);
export const RoomAnswersSchema = z.tuple([
  z.string().trim().max(2000),
  z.string().trim().max(2000),
  z.string().trim().max(2000),
  z.string().trim().max(2000),
]);
export const CreateRoomRequestSchema = z.object({ ...Base, scenario: RoomScenarioSchema, adultConfirmed: z.literal(true) }).strict();
export const JoinRoomRequestSchema = z.object({ ...Base, invitationToken: z.string().regex(/^cave_ri_[A-Za-z0-9_-]{43}$/u), adultConfirmed: z.literal(true) }).strict();
export const SaveRoomAnswersRequestSchema = z.object({ ...Base, answers: RoomAnswersSchema }).strict();
export const CompleteRoomAnswersRequestSchema = z.object({ ...Base, authorizeSharedReport: z.literal(true) }).strict();
export const RoomActionRequestSchema = z.object(Base).strict();
export const RoomStatusSchema = z.object({
  id: Id, scenario: RoomScenarioSchema, role: z.enum(["owner", "invitee"]),
  partnerJoined: z.boolean(), ownCompleted: z.boolean(), partnerCompleted: z.boolean(),
  reportStatus: z.enum(["waiting", "ready", "generating", "paused", "insufficient"]),
  expiresAt: DateTime,
}).strict();
export const RoomStatusResponseSchema = z.object({ ...Base, room: RoomStatusSchema, ownAnswers: RoomAnswersSchema.nullable() }).strict();
export const RoomListResponseSchema = z.object({ ...Base, rooms: z.array(z.object({ room: RoomStatusSchema, ownAnswers: RoomAnswersSchema.nullable() }).strict()).max(50) }).strict();
export const CreateRoomResponseSchema = z.object({ ...Base, room: RoomStatusSchema, invitationToken: z.string(), invitationExpiresAt: DateTime }).strict();
export const ReissueRoomInvitationResponseSchema = z.object({ ...Base, roomId: Id, invitationToken: z.string(), invitationExpiresAt: DateTime }).strict();
export const RoomReportEvidenceIdSchema = z.enum([
  "A.expectation", "A.concern", "A.boundary", "A.response_next_step",
  "B.expectation", "B.concern", "B.boundary", "B.response_next_step",
]);
const Evidence = z.array(RoomReportEvidenceIdSchema).min(1).max(8).refine(values => new Set(values).size === values.length);
const Section = z.object({ text: z.string().min(20).max(220), evidence: Evidence }).strict();
const ReportBase = { version: z.literal("paired-report-v0.2"), scenarioId: RoomScenarioSchema };
export const RoomReportSchema = z.discriminatedUnion("status", [
  z.object({ ...ReportBase, status: z.literal("ready"),
    sections: z.object({
      commonAndDifferences: Section,
      adviceForBoth: Section,
      nextSteps: Section,
    }).strict(),
  }).strict(),
  z.object({ ...ReportBase, status: z.literal("paused"),
    message: z.literal("这次暂不生成共同报告。请先在各自安全、自在的条件下决定是否继续使用；不需要为了完成报告而继续讨论。"),
  }).strict(),
  z.object({ ...ReportBase, status: z.literal("insufficient"),
    message: z.literal("目前没有足够的双方信息生成有依据的共同报告。可以各自补充、跳过，或结束本次填写。"),
  }).strict(),
]);
const PublicSection = z.object({ text: z.string().min(20).max(220) }).strict();
export const PublicRoomReportSchema = z.discriminatedUnion("status", [
  z.object({ ...ReportBase, status: z.literal("ready"),
    sections: z.object({
      commonAndDifferences: PublicSection,
      adviceForBoth: PublicSection,
      nextSteps: PublicSection,
    }).strict(),
  }).strict(),
  z.object({ ...ReportBase, status: z.literal("paused"),
    message: z.literal("这次暂不生成共同报告。请先在各自安全、自在的条件下决定是否继续使用；不需要为了完成报告而继续讨论。"),
  }).strict(),
  z.object({ ...ReportBase, status: z.literal("insufficient"),
    message: z.literal("目前没有足够的双方信息生成有依据的共同报告。可以各自补充、跳过，或结束本次填写。"),
  }).strict(),
]);
export const RoomReportResponseSchema = z.object({ ...Base, roomId: Id, report: PublicRoomReportSchema }).strict();

export type RoomScenario = z.infer<typeof RoomScenarioSchema>;
export type RoomAnswers = z.infer<typeof RoomAnswersSchema>;
export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;
export type JoinRoomRequest = z.infer<typeof JoinRoomRequestSchema>;
export type SaveRoomAnswersRequest = z.infer<typeof SaveRoomAnswersRequestSchema>;
export type CompleteRoomAnswersRequest = z.infer<typeof CompleteRoomAnswersRequestSchema>;
export type RoomStatus = z.infer<typeof RoomStatusSchema>;
export type RoomStatusResponse = z.infer<typeof RoomStatusResponseSchema>;
export type RoomListResponse = z.infer<typeof RoomListResponseSchema>;
export type CreateRoomResponse = z.infer<typeof CreateRoomResponseSchema>;
export type ReissueRoomInvitationResponse = z.infer<typeof ReissueRoomInvitationResponseSchema>;
export type RoomReport = z.infer<typeof RoomReportSchema>;
export type PublicRoomReport = z.infer<typeof PublicRoomReportSchema>;
export type RoomReportResponse = z.infer<typeof RoomReportResponseSchema>;

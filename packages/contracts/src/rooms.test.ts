import { describe, expect, it } from "vitest";
import { CreateRoomRequestSchema, JoinRoomRequestSchema, RoomAnswersSchema, RoomReportSchema } from "./rooms";

const requestId = "6cc380dd-f5b0-4e39-bac4-54fa9b4abcc1";

describe("paired room contracts", () => {
  it("requires an explicit adult declaration on create and join", () => {
    expect(CreateRoomRequestSchema.safeParse({ contractVersion: "1", requestId, scenario: "pause", adultConfirmed: false }).success).toBe(false);
    expect(JoinRoomRequestSchema.safeParse({ contractVersion: "1", requestId, invitationToken: `cave_ri_${"a".repeat(43)}`, adultConfirmed: false }).success).toBe(false);
    expect(CreateRoomRequestSchema.safeParse({ contractVersion: "1", requestId, scenario: "pause", adultConfirmed: true }).success).toBe(true);
  });

  it("keeps four fixed answer positions even when skipped", () => {
    expect(RoomAnswersSchema.safeParse(["", "", "", ""]).success).toBe(true);
    expect(RoomAnswersSchema.safeParse(["one", "two", "three"]).success).toBe(false);
  });

  it("accepts a grounded draft report and rejects invented evidence identifiers", () => {
    const report = {
      version: "paired-report-v0.1", scenarioId: "pause", status: "ready",
      commonGround: [{ text: "双方愿意暂停。", evidence: ["A.expectation", "B.expectation"] }],
      differences: [{ text: "双方关注点不同。", evidence: ["A.concern", "B.concern"] }],
      advice: {
        A: [{ say: "我先停。", do: "保留暂停。", evidence: ["A.boundary"] }],
        B: [{ say: "我会停。", do: "尊重边界。", evidence: ["B.boundary"] }],
      },
      togetherNextSteps: [{ text: "另行确认。", evidence: ["A.response_next_step"] }],
      uncertainties: [{ text: "是否再谈未定。", evidence: ["B.response_next_step"] }],
    };
    expect(RoomReportSchema.safeParse(report).success).toBe(true);
    expect(RoomReportSchema.safeParse({ ...report, commonGround: [{ text: "无根据", evidence: ["A.imaginary"] }] }).success).toBe(false);
  });
});

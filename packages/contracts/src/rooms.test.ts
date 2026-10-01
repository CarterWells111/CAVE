import { describe, expect, it } from "vitest";
import { CreateRoomRequestSchema, JoinRoomRequestSchema, RoomAnswersSchema, RoomReportResponseSchema, RoomReportSchema } from "./rooms";

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
      version: "paired-report-v0.2", scenarioId: "pause", status: "ready",
      sections: {
        commonAndDifferences: { text: "双方都希望暂停后先停止触碰，但对何时再谈仍有不同期待，需要继续确认。", evidence: ["A.expectation", "B.expectation"] },
        adviceForBoth: { text: "值得共同确认暂停后的空间与联系时机，讨论时保留各自不继续的选择。", evidence: ["A.boundary", "B.boundary"] },
        nextSteps: { text: "若双方愿意，可先约定暂停即停止；至于再次交流的时间，仍需要另行确认。", evidence: ["A.response_next_step", "B.response_next_step"] },
      },
    };
    expect(RoomReportSchema.safeParse(report).success).toBe(true);
    expect(RoomReportSchema.safeParse({ ...report, sections: { ...report.sections, commonAndDifferences: { ...report.sections.commonAndDifferences, evidence: ["A.imaginary"] } } }).success).toBe(false);
    expect(RoomReportResponseSchema.safeParse({ contractVersion: "1", requestId, roomId: requestId, report }).success).toBe(false);
  });
});

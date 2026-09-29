import type { RoomReport } from "./room";

export const REPORT_SECTION_TITLES = ["共同点与差异", "给你们的建议", "接下来的建议"] as const;
export const REPORT_ROLE_NOTE = "A 是房间发起人，B 是受邀者。";

export function formatRoomReport(report: RoomReport): string {
  if (report.status !== "ready") return report.message;
  return [
    `${REPORT_SECTION_TITLES[0]}\n${REPORT_ROLE_NOTE}\n${report.sections.commonAndDifferences}`,
    `${REPORT_SECTION_TITLES[1]}\n${report.sections.adviceForBoth}`,
    `${REPORT_SECTION_TITLES[2]}\n${report.sections.nextSteps}`,
  ].join("\n\n");
}

export function roomReportAiDraft(report: RoomReport): string {
  if (report.status !== "ready") throw new Error("room-report-not-ready");
  const text = `${formatRoomReport(report)}\n\n请根据这份报告问我一个具体问题，帮助我补充未涉及的情景或进一步说明仍不确定的地方。`;
  if (text.length > 1000) throw new Error("room-report-ai-draft-too-long");
  return text;
}

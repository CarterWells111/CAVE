import { formatRoomReport, roomReportAiDraft } from "./report-text";

const report = { status: "ready" as const, sections: {
  commonAndDifferences: "双方都愿意先吃饭，但对是否留宿的决定时间不同。",
  adviceForBoth: "先讨论结束时间和暂停方式，留意每个人是否有自由拒绝的空间。",
  nextSteps: "先定晚饭安排；是否留宿之后再分别确认。具体结束时间仍未确定。",
} };

test("shared report has exactly three visible sections and an editable AI follow-up question", () => {
  const text = formatRoomReport(report);
  expect(text.split("\n\n")).toHaveLength(3);
  expect(text).toContain("共同点与差异\n");
  expect(text).toContain("给你们的建议\n");
  expect(text).toContain("接下来的建议\n");
  expect(text).not.toContain("evidence");
  expect(text).not.toContain("可以说：");
  expect(roomReportAiDraft(report)).toContain("仍不确定的地方");
  expect(roomReportAiDraft(report).length).toBeLessThanOrEqual(1000);
});

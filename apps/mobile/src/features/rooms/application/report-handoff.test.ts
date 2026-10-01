import { reportJournalDraftKey, stageReportHandoff, takeReportHandoff } from "./report-handoff";

test("report handoff is one-shot and scoped to destination and account", () => {
  stageReportHandoff("ai", "account-a", "room-1", "共同报告");
  expect(takeReportHandoff("journal", "account-a")).toBeNull();
  expect(takeReportHandoff("ai", "account-a")).toMatchObject({ roomId: "room-1", text: "共同报告" });
  expect(takeReportHandoff("ai", "account-a")).toBeNull();
  stageReportHandoff("journal", "account-a", "room-1", "另一次报告");
  expect(takeReportHandoff("journal", "account-b")).toBeNull();
  expect(takeReportHandoff("journal", "account-a")).toBeNull();
});

test("staged report expires instead of appearing in a later session", () => {
  const now = jest.spyOn(Date, "now").mockReturnValue(1000);
  try {
    stageReportHandoff("ai", "account-a", "room-2", "报告");
    now.mockReturnValue(1000 + 5 * 60 * 1000 + 1);
    expect(takeReportHandoff("ai", "account-a")).toBeNull();
  } finally { now.mockRestore(); }
});

test("room report journal drafts are isolated from freeform and prior report versions", () => {
  const key = reportJournalDraftKey("room-1", "共同报告 A");
  expect(key).toMatch(/^new:room-report:room-1:/u);
  expect(key).not.toBe("new:freeform");
  expect(reportJournalDraftKey("room-1", "共同报告 B")).not.toBe(key);
  expect(reportJournalDraftKey("room-1", "共同报告 A")).toBe(key);
});

import type { AssistantResponse } from "@cave/contracts";
import { growthReviewPlainText, normalizeGrowthReviewResponse } from "./growth-review-output";

test("growth formatting removes markdown markers while preserving headings and three existing paragraphs", () => {
  const input = "# 行为总结\n**你写下了两篇手记。**\n\n## 内容总结\n> 你提到想更清楚地表达边界。\n\n### 推荐行动\n- 先挑选一句想练习的话。";
  expect(growthReviewPlainText(input)).toBe("行为总结\n你写下了两篇手记。\n\n内容总结\n你提到想更清楚地表达边界。\n\n推荐行动\n先挑选一句想练习的话。");
});

test("common inline and task-list markers become plain text without losing checklist state", () => {
  const input = "- [x] 留下过一条记录。\n- [ ] 再挑选一件事。\n1. _先做一小步_。\n~~可以暂时放下的想法~~";
  expect(growthReviewPlainText(input)).toBe("已勾选：留下过一条记录。\n未勾选：再挑选一件事。\n先做一小步。\n可以暂时放下的想法");
});

test("code fences and links lose presentation syntax while preserving their contents", () => {
  const backtick = String.fromCharCode(96);
  const fence = backtick.repeat(3);
  const input = fence + "text\n请先保留这个安全安排。\n" + fence + "\n\n可以说 " + backtick + "我想暂停" + backtick + "，或查看[已有的支持信息](https://example.test/help)。";
  expect(growthReviewPlainText(input)).toBe("请先保留这个安全安排。\n\n可以说 我想暂停，或查看已有的支持信息（https://example.test/help）。");
});

test("formatting does not delete disclaimer text, safety advice or mathematical symbols", () => {
  const safety = "如果你现在有立即受伤的危险，请先离开危险处并向身边可信任的人或紧急服务求助。";
  const input = "作为 AI，我不能替你做决定。\n\n**" + safety + "**\n\n数值：2 * 3 * 4。\n> 5\n记录键：one_two_three。";
  const output = growthReviewPlainText(input);
  expect(output).toContain("作为 AI，我不能替你做决定。");
  expect(output).toContain(safety);
  expect(output).toContain("2 * 3 * 4");
  expect(output).toContain("> 5");
  expect(output).toContain("one_two_three");
});

test("a brief no-record answer remains brief instead of being expanded to three paragraphs", () => {
  const message = "这段时间未找到足够的回顾记录。可以先记下一件今天在意的小事。";
  expect(growthReviewPlainText(message)).toBe(message);
  expect(growthReviewPlainText(message).split("\n\n")).toHaveLength(1);
});

test("all response text and evidence survive scoped normalization, including safety status", () => {
  const response: AssistantResponse = {
    status: "blocked", providerMode: "live", message: "## 先顾好眼前的安全\n**请先联系身边可信任的人。**",
    question: "_你现在身边有人吗_？", summary: "**保留已有的安全安排。**",
    observations: [{ text: "> 留意记录里已经明确的暂停约定。", sourceRecordIds: ["selected-record"] }],
    sources: [{ id: "selected-record", title: "既有记录" }],
  };
  const normalized = normalizeGrowthReviewResponse(response);
  expect(normalized).toMatchObject({
    status: "blocked", providerMode: "live", message: "先顾好眼前的安全\n请先联系身边可信任的人。",
    question: "你现在身边有人吗？", summary: "保留已有的安全安排。",
    observations: [{ text: "留意记录里已经明确的暂停约定。", sourceRecordIds: ["selected-record"] }],
    sources: response.sources,
  });
  expect(response.message).toContain("##");
});

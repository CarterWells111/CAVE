import { describe, expect, it } from "vitest";
import { checkJournalWritingVoice } from "../src/services/journal-writing-voice";

describe("journal writing voice", () => {
  it("accepts first-person writing and natural titles without confusing AI topics with commentary", () => {
    for (const text of ["我今天去了河边。", "我们散了步。", "我今天学习了AI开发。"])
      expect(checkJournalWritingVoice(text)).toEqual({ ok: true });
    expect(checkJournalWritingVoice("河边的傍晚", {}, false)).toEqual({ ok: true });
    expect(checkJournalWritingVoice("河边的傍晚")).toEqual({ ok: false, reason: "missing_first_person" });
  });
  it.each(["你今天去散步了，我想记录下来。", "我想告诉您这段经历。", "你的傍晚"])("rejects second-person narration: %s", text => {
    expect(checkJournalWritingVoice(text, {}, false)).toEqual({ ok: false, reason: "second_person" });
  });
  it.each(["作为AI，我整理了这段经历。", "AI说明：我今天散了步。", "优化后的手记如下：我今天散了步。", "改写版本：我今天散了步。", "以下是优化后的正文：我去了河边。", "我去了河边。\n注：根据描述整理。", "我去了河边。[^1]"])("rejects explanation or footnote prose: %s", text => {
    expect(checkJournalWritingVoice(text)).toEqual({ ok: false, reason: "ai_commentary" });
  });
  it("preserves attributed dialogue from actual journal JSON bodies and additions", () => {
    const records = [{ id: "selected", text: JSON.stringify({ title: "散步", body: "我对朋友说：‘你可以先坐下。’", entries: [{ body: "朋友回答：‘你也歇一会儿。’" }] }) }];
    expect(checkJournalWritingVoice("傍晚，我对朋友说：‘你可以先坐下。’朋友回答：‘你也歇一会儿。’", { records })).toEqual({ ok: true });
    expect(checkJournalWritingVoice("我对朋友说：‘你明天一定会成功。’", { records })).toEqual({ ok: false, reason: "second_person" });
  });
  it("uses plain-text records and user statements for real quotes without treating wrapping as attribution", () => {
    const text = "我对朋友说：“你可以先坐下。”";
    expect(checkJournalWritingVoice(text, { records: [{ id: "plain", text }] })).toEqual({ ok: true });
    expect(checkJournalWritingVoice(text, { userTexts: [text] })).toEqual({ ok: true });
    expect(checkJournalWritingVoice("“你可以先坐下。”我记下这句话。", { userTexts: [text] })).toEqual({ ok: false, reason: "second_person" });
    expect(checkJournalWritingVoice("“我对你说可以坐下。”", { userTexts: ["我对你说可以坐下。"] }).ok).toBe(false);
    expect(checkJournalWritingVoice("我去了公园。", { records: [{ id: "plain", text: "普通原文，未使用JSON。" }] })).toEqual({ ok: true });
  });
  it("authorizes only user statements in derived review context, never prompts, assistant examples or pending drafts", () => {
    const quote = "你可以先坐下。";
    const body = `我对朋友说：“${quote}”`;
    const context = (user: string, assistant: string) => ({ id: "journal-review-conversation", text: JSON.stringify({ referenceType: "journal-review-context", reviewTask: { instructions: body, guidingQuestions: [body] }, recentConversation: [{ user, assistant: { message: assistant, question: body } }] }) });
    expect(checkJournalWritingVoice(body, { records: [context(body, "这段经历值得记下。 ")] })).toEqual({ ok: true });
    expect(checkJournalWritingVoice(body, { records: [context("我去了公园。", body)] })).toEqual({ ok: false, reason: "second_person" });
    expect(checkJournalWritingVoice(body, { records: [{ id: "journal-review-current-draft", text: body }] })).toEqual({ ok: false, reason: "second_person" });
  });
  it("rejects third-person prose that never adopts the user's voice", () => {
    expect(checkJournalWritingVoice("她傍晚去河边散步，心情渐渐平静。"))
      .toEqual({ ok: false, reason: "missing_first_person" });
  });
  it.each(["message", "question", "instructions"] as const)("does not authorize dialogue supplied only by review %s", field => {
    const body = "我对朋友说：“你可以先坐下。”";
    const assistant = field === "instructions" ? {} : { [field]: body };
    const reviewTask = field === "instructions" ? { instructions: body } : {};
    const records = [{
      id: "journal-review-conversation",
      text: JSON.stringify({
        referenceType: "journal-review-context",
        reviewTask,
        recentConversation: [{ user: "我傍晚去了河边。", assistant }]
      })
    }];
    expect(checkJournalWritingVoice(body, { records })).toEqual({ ok: false, reason: "second_person" });
  });
  it("does not treat a pending derived draft context as evidence for a new quote", () => {
    const body = "我对朋友说：“你可以先坐下。”";
    const records = [{
      id: "journal-review-current-draft.context",
      text: JSON.stringify({ title: "散步", body, entries: [] })
    }];
    expect(checkJournalWritingVoice(body, { records })).toEqual({ ok: false, reason: "second_person" });
  });
});

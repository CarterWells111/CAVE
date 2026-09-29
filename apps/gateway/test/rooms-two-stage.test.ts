import { describe, expect, it, vi } from "vitest";
import sampleLedger from "../../../docs/calibration/paired-room/two-stage/example-pause-ledger.json";
import samplePlan from "../../../docs/calibration/paired-room/two-stage/example-pause-plan.json";
import sampleReport from "../../../docs/calibration/paired-room/two-stage/example-pause-report.json";
import { createRoomReportProvider, insufficientReport, type RoomReportInput } from "../src/rooms/report-provider";
import { contentHash, renderRoomReport, roomFactCatalog, roomRenderTemplates, validateFactLedger, validateReportPlan } from "../src/rooms/two-stage";

const sampleInput: RoomReportInput = { scenarioId: "pause", consent: { A: true, B: true }, answers: {
  A: { expectation: "暂停就是立刻停止触碰和追问。", concern: "我怕暂停后还要解释原因。",
    boundary: "我说停就请先停，给我一小时独处；是否再谈由我另行提出。", response_next_step: "希望先听到好，我们停，不要问为什么。" },
  B: { expectation: "暂停就是当下停止，之后不急着恢复。", concern: "我担心不知道是否还能再谈。",
    boundary: "听到停会停止触碰；不会自行恢复。", response_next_step: "我可以先说好，之后等对方提出，再问是否愿意聊。" },
} };
const candidate = () => structuredClone(sampleLedger);
const overnightInput: RoomReportInput = { scenarioId: "first-overnight", consent: { A: true, B: true }, answers: {
  A: { expectation: "想一起做饭、聊天，晚上能各自休息。", concern: "我睡眠浅，怕临时决定住下会睡不好。",
    boundary: "这次不想有性行为；如果疲惫，我想随时回家。", response_next_step: "希望对方听到我想回家时说好。可以先约好结束时间。" },
  B: { expectation: "想一起吃晚饭，看看能不能自然地待到第二天。", concern: "担心提议留宿会给对方压力。",
    boundary: "不把过夜当作任何亲密行为的承诺；对方想回家就停。", response_next_step: "希望能直接知道对方是否想留宿。可以先确定晚饭，之后再问一次。" },
} };
const overnightLedger = {
  version: "paired-facts-v0.1", scenarioId: "first-overnight", status: "ready",
  facts: [
    { id: "f1", owner: "A", answerId: "A.expectation", sourceSpan: "想一起做饭、聊天", code: "wants_evening_together", scope: "current" },
    { id: "f2", owner: "B", answerId: "B.expectation", sourceSpan: "想一起吃晚饭", code: "wants_evening_together", scope: "current" },
    { id: "f3", owner: "A", answerId: "A.concern", sourceSpan: "怕临时决定住下会睡不好", code: "fears_sleep_disruption", scope: "current" },
    { id: "f4", owner: "B", answerId: "B.concern", sourceSpan: "担心提议留宿会给对方压力", code: "fears_pressuring_other", scope: "current" },
    { id: "f5", owner: "A", answerId: "A.boundary", sourceSpan: "如果疲惫，我想随时回家", code: "wants_leave_when_tired", scope: "when_owner_tired" },
    { id: "f6", owner: "B", answerId: "B.boundary", sourceSpan: "对方想回家就停", code: "stops_if_other_leaves", scope: "when_other_wants_leave" },
  ],
  relations: [
    { id: "r1", kind: "shared", topic: "activity", factIds: ["f1", "f2"] },
    { id: "r2", kind: "compatible", topic: "boundaries", factIds: ["f5", "f6"] },
    { id: "r3", kind: "different", topic: "concern", factIds: ["f3", "f4"] },
  ], openItems: [],
};
const touchInput: RoomReportInput = { scenarioId: "adjust", consent: { A: true, B: true }, answers: {
  A: { expectation: "想散步聊天，身体接触先少一点。", concern: "担心慢一点被理解成迟早会答应拥抱。",
    boundary: "现在不想拥抱；牵手也暂不确定，先问我。", response_next_step: "希望对方说可以不碰，这周先一起散步。" },
  B: { expectation: "想多一些陪伴，一起散步也好。", concern: "担心问太多会打断相处。",
    boundary: "不会在未确认前拥抱或牵手；对方不想碰就不碰。", response_next_step: "我可以先说我们先散步，需要触碰时再问。" },
} };
const touchLedger = {
  version: "paired-facts-v0.1", scenarioId: "adjust", status: "ready",
  facts: [
    { id: "f1", owner: "A", answerId: "A.expectation", sourceSpan: "想散步聊天", code: "wants_walk_together", scope: "current" },
    { id: "f2", owner: "B", answerId: "B.expectation", sourceSpan: "想多一些陪伴，一起散步", code: "wants_walk_together", scope: "current" },
    { id: "f3", owner: "A", answerId: "A.concern", sourceSpan: "担心慢一点被理解成迟早会答应拥抱", code: "fears_slow_means_future_yes", scope: "current" },
    { id: "f4", owner: "B", answerId: "B.concern", sourceSpan: "担心问太多会打断相处", code: "fears_questions_interrupt", scope: "current" },
    { id: "f5", owner: "A", answerId: "A.boundary", sourceSpan: "现在不想拥抱", code: "no_hug_now", scope: "current" },
    { id: "f6", owner: "B", answerId: "B.boundary", sourceSpan: "不会在未确认前拥抱或牵手", code: "no_hug_handhold_without_check", scope: "before_touch" },
    { id: "f7", owner: "B", answerId: "B.response_next_step", sourceSpan: "需要触碰时再问", code: "ask_before_touch", scope: "before_touch" },
  ],
  relations: [
    { id: "r1", kind: "shared", topic: "activity", factIds: ["f1", "f2"] },
    { id: "r2", kind: "compatible", topic: "touch", factIds: ["f5", "f6"] },
    { id: "r3", kind: "different", topic: "concern", factIds: ["f3", "f4"] },
  ], openItems: [],
};
const pauseParaphraseInput: RoomReportInput = { scenarioId: "pause", consent: { A: true, B: true }, answers: {
  A: { expectation: "喊暂停就马上停止身体接触和追问。", concern: "停下后我不想马上解释理由。",
    boundary: "我喊暂停后请让我单独待六十分钟；准备好了会主动提能否再聊。", response_next_step: "先答应停下，别继续问。" },
  B: { expectation: "听到暂停先停，不着急继续。", concern: "怕停下后不知道还有没有机会交流。",
    boundary: "听到暂停会停止接触，也不会自己恢复。", response_next_step: "我先确认已经停了；之后等你主动开启话题，再问是否愿意聊。" },
} };
const pauseParaphraseLedger = {
  version: "paired-facts-v0.1", scenarioId: "pause", status: "ready",
  facts: [
    { id: "f1", owner: "A", answerId: "A.expectation", sourceSpan: "喊暂停就马上停止身体接触", code: "pause_stop_touch", scope: "when_owner_pauses" },
    { id: "f2", owner: "B", answerId: "B.boundary", sourceSpan: "听到暂停会停止接触", code: "pause_stop_touch", scope: "when_other_pauses" },
    { id: "f3", owner: "A", answerId: "A.boundary", sourceSpan: "准备好了会主动提能否再聊", code: "retalk_self_initiates", scope: "after_rest" },
    { id: "f4", owner: "B", answerId: "B.response_next_step", sourceSpan: "之后等你主动开启话题", code: "waits_other_retalk", scope: "after_rest" },
    { id: "f5", owner: "A", answerId: "A.concern", sourceSpan: "停下后我不想马上解释理由", code: "fears_explanation_demand", scope: "current" },
    { id: "f6", owner: "B", answerId: "B.concern", sourceSpan: "怕停下后不知道还有没有机会交流", code: "fears_no_retalk", scope: "current" },
    { id: "f7", owner: "A", answerId: "A.boundary", sourceSpan: "我喊暂停后请让我单独待六十分钟", code: "needs_one_hour_alone", scope: "when_owner_pauses" },
  ],
  relations: [
    { id: "r1", kind: "shared", topic: "pause", factIds: ["f1", "f2"] },
    { id: "r2", kind: "compatible", topic: "retalk", factIds: ["f3", "f4"] },
    { id: "r3", kind: "different", topic: "concern", factIds: ["f5", "f6"] },
  ], openItems: [],
};
const overnightParaphraseInput: RoomReportInput = { scenarioId: "first-overnight", consent: { A: true, B: true }, answers: {
  A: { expectation: "想和对方在晚上做顿饭、聊聊天。", concern: "临时留在对方那里，我怕睡不好。",
    boundary: "这回不想有性行为；累了我会回自己家。", response_next_step: "想先定个结束时刻。" },
  B: { expectation: "希望晚餐一起吃，也想看看能否待到第二天。", concern: "邀请对方留下也许会让对方感到压力。",
    boundary: "过夜不代表同意亲密行为；对方想回去我就停。", response_next_step: "先吃饭，饭后再问对方想不想留下。" },
} };
const overnightParaphraseLedger = {
  version: "paired-facts-v0.1", scenarioId: "first-overnight", status: "ready",
  facts: [
    { id: "f1", owner: "A", answerId: "A.expectation", sourceSpan: "想和对方在晚上做顿饭、聊聊天", code: "wants_evening_together", scope: "current" },
    { id: "f2", owner: "B", answerId: "B.expectation", sourceSpan: "希望晚餐一起吃", code: "wants_evening_together", scope: "current" },
    { id: "f3", owner: "A", answerId: "A.concern", sourceSpan: "临时留在对方那里，我怕睡不好", code: "fears_sleep_disruption", scope: "current" },
    { id: "f4", owner: "B", answerId: "B.concern", sourceSpan: "邀请对方留下也许会让对方感到压力", code: "fears_pressuring_other", scope: "current" },
    { id: "f5", owner: "A", answerId: "A.boundary", sourceSpan: "累了我会回自己家", code: "wants_leave_when_tired", scope: "when_owner_tired" },
    { id: "f6", owner: "B", answerId: "B.boundary", sourceSpan: "对方想回去我就停", code: "stops_if_other_leaves", scope: "when_other_wants_leave" },
  ],
  relations: [
    { id: "r1", kind: "shared", topic: "activity", factIds: ["f1", "f2"] },
    { id: "r2", kind: "compatible", topic: "boundaries", factIds: ["f5", "f6"] },
    { id: "r3", kind: "different", topic: "concern", factIds: ["f3", "f4"] },
  ], openItems: [],
};

describe("two-stage paired report", () => {
  it("validates the pause ledger and plan and renders the reviewed fixed text", async () => {
    const ledger = validateFactLedger(sampleLedger, sampleInput);
    expect(ledger.status).toBe("ready");
    if (ledger.status !== "ready") throw new Error("sample ledger is not ready");
    expect(await validateReportPlan(samplePlan, ledger)).toEqual(samplePlan);
    expect(await renderRoomReport(ledger, samplePlan)).toEqual(sampleReport);
  });

  it("rejects exact source text assigned an unsupported fact code", () => {
    const ledger = candidate();
    ledger.facts[0]!.code = "wants_walk_together";
    ledger.facts[0]!.scope = "current";
    expect(() => validateFactLedger(ledger, sampleInput)).toThrow("fact-source-meaning");
  });

  it("returns neutral insufficient for an explicitly unclassified source", async () => {
    const ledger = candidate();
    ledger.facts[0]!.code = "other";
    ledger.facts[0]!.scope = "current";
    expect(validateFactLedger(ledger, sampleInput).status).toBe("insufficient");
    let calls = 0;
    const provider = createRoomReportProvider(async () => { calls += 1; return ledger; });
    expect((await provider.generate(sampleInput, new AbortController().signal)).status).toBe("insufficient");
    expect(calls).toBe(1);
  });

  it("does not promote a negated or attributed phrase into a personal positive fact", () => {
    const negatedInput = structuredClone(sampleInput);
    negatedInput.answers.A.expectation = "我不觉得暂停就是需要停止触碰。";
    const negated = candidate();
    negated.facts[0]!.sourceSpan = "停止触碰";
    expect(validateFactLedger(negated, negatedInput).status).toBe("insufficient");

    const attributedInput = structuredClone(sampleInput);
    attributedInput.answers.A.expectation = "对方说想一起散步，我不想。";
    const attributed = candidate();
    attributed.facts[0]!.sourceSpan = "想一起散步";
    attributed.facts[0]!.code = "wants_walk_together";
    attributed.facts[0]!.scope = "current";
    expect(validateFactLedger(attributed, attributedInput).status).toBe("insufficient");
  });

  it("keeps a personal pause condition attached to its speaker", () => {
    const ledger = candidate();
    ledger.facts[6]!.scope = "when_other_pauses";
    expect(() => validateFactLedger(ledger, sampleInput)).toThrow("fact-code-scope");
  });

  it("does not turn compatible re-talk answers into conflict or an open question", () => {
    const different = candidate();
    different.relations[1]!.kind = "different";
    expect(() => validateFactLedger(different, sampleInput)).toThrow("relation-difference");

    const unknown = candidate();
    unknown.openItems.push({ id: "u1", kind: "one_sided_proposal", topic: "retalk", factId: "f3", missingSide: "B" } as never);
    expect(() => validateFactLedger(unknown, sampleInput)).toThrow("one-sided-proposal-already-answered");
  });

  it("keeps a genuinely unanswered re-talk proposal open", () => {
    const input = structuredClone(sampleInput);
    input.answers.B.response_next_step = "之后再确认是否愿意聊。";
    const ledger = candidate();
    ledger.facts = ledger.facts.filter(fact => fact.id !== "f4");
    ledger.relations = ledger.relations.filter(relation => relation.id !== "r2");
    ledger.openItems = [{ id: "u1", kind: "one_sided_proposal", topic: "retalk", factId: "f3", missingSide: "B" }] as never;
    expect(validateFactLedger(ledger, input).status).toBe("ready");
  });

  it("rejects plan drift from the validated ledger and invalid template prerequisites", async () => {
    const ledger = validateFactLedger(sampleLedger, sampleInput);
    if (ledger.status !== "ready") throw new Error("sample ledger is not ready");
    const changedHash = structuredClone(samplePlan);
    changedHash.ledgerSha256 = "0".repeat(64);
    await expect(validateReportPlan(changedHash, ledger)).rejects.toThrow("plan-hashes");
    const wrongAction = structuredClone(samplePlan);
    wrongAction.sections.nextSteps.actionCodes = ["walk_first"];
    await expect(validateReportPlan(wrongAction, ledger)).rejects.toThrow("plan-action-scenario");
  });

  it("calls the provider twice and never returns model-authored final prose", async () => {
    const prompts: string[] = [];
    const provider = createRoomReportProvider(async (prompt, data) => {
      prompts.push(prompt);
      if (prompts.length === 1) {
        expect(JSON.parse(data)).toEqual(sampleInput);
        return sampleLedger;
      }
      expect(JSON.parse(data).ledger).toEqual(sampleLedger);
      return samplePlan;
    });
    expect(await provider.generate(sampleInput, new AbortController().signal)).toEqual(sampleReport);
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("不输出自由文本或最终报告");
  });

  it("aborts a stalled fact stage within its share of the service deadline", async () => {
    vi.useFakeTimers();
    try {
      const provider = createRoomReportProvider(async (_prompt, _data, signal) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }));
      const pending = expect(provider.generate(sampleInput, new AbortController().signal))
        .rejects.toMatchObject({ code: "MODEL_TIMEOUT", status: 504 });
      await vi.advanceTimersByTimeAsync(12_000);
      await pending;
    } finally { vi.useRealTimers(); }
  });

  it("aborts a stalled plan stage within its share of the service deadline", async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      let enteredPlan!: () => void;
      const planStarted = new Promise<void>(resolve => { enteredPlan = resolve; });
      const provider = createRoomReportProvider(async (_prompt, _data, signal) => {
        calls += 1;
        if (calls === 1) return sampleLedger;
        enteredPlan();
        return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
      });
      const pending = expect(provider.generate(sampleInput, new AbortController().signal))
        .rejects.toMatchObject({ code: "MODEL_TIMEOUT", status: 504 });
      await planStarted;
      expect(calls).toBe(2);
      await vi.advanceTimersByTimeAsync(10_000);
      await pending;
    } finally { vi.useRealTimers(); }
  });

  it("keeps overnight pressure and the return response on the side that stated them", () => {
    expect(validateFactLedger(overnightLedger, overnightInput).status).toBe("ready");
    const inventedShared = structuredClone(overnightLedger);
    inventedShared.facts[2]!.code = "fears_pressuring_other";
    inventedShared.relations[2]!.kind = "shared";
    expect(() => validateFactLedger(inventedShared, overnightInput)).toThrow("fact-source-meaning");
    const inventedUnknown = structuredClone(overnightLedger);
    inventedUnknown.openItems.push({ id: "u1", kind: "one_sided_proposal", topic: "boundaries", factId: "f6", missingSide: "A" } as never);
    expect(() => validateFactLedger(inventedUnknown, overnightInput)).toThrow("one-sided-proposal");
  });

  it("keeps the touch asker known when A asks to be asked and B offers to ask", () => {
    expect(validateFactLedger(touchLedger, touchInput).status).toBe("ready");
    const oneBoundary = structuredClone(touchLedger);
    oneBoundary.facts[5]!.sourceSpan = "不会在未确认前拥抱";
    expect(() => validateFactLedger(oneBoundary, touchInput)).toThrow("fact-source-meaning:no_hug_handhold_without_check");
    const inventedUnknown = structuredClone(touchLedger);
    inventedUnknown.openItems.push({ id: "u1", kind: "one_sided_proposal", topic: "touch", factId: "f7", missingSide: "A" } as never);
    expect(() => validateFactLedger(inventedUnknown, touchInput)).toThrow("one-sided-proposal-already-answered");
  });

  it("accepts the supported sixty-minute and re-talk paraphrases", () => {
    expect(validateFactLedger(pauseParaphraseLedger, pauseParaphraseInput).status).toBe("ready");
  });

  it("accepts the supported dinner and return-home paraphrases", () => {
    expect(validateFactLedger(overnightParaphraseLedger, overnightParaphraseInput).status).toBe("ready");
  });

  it("requires the after-dinner question to be about staying overnight in the cited span", () => {
    const input = structuredClone(overnightParaphraseInput);
    input.answers.B.response_next_step = "我想留宿。饭后再问对方要不要散步。";
    const ledger = structuredClone(overnightParaphraseLedger);
    ledger.facts.push({ id: "f7", owner: "B", answerId: "B.response_next_step", sourceSpan: "饭后再问对方要不要散步", code: "asks_overnight_after_dinner", scope: "after_dinner" });
    expect(() => validateFactLedger(ledger, input)).toThrow("fact-source-meaning:asks_overnight_after_dinner");

    input.answers.B.response_next_step = "饭后再问对方想不想留下。";
    ledger.facts[6]!.sourceSpan = "饭后再问对方想不想留下";
    expect(validateFactLedger(ledger, input).status).toBe("ready");
  });

  it("accepts common colloquial touch phrases while rejecting quoted speech", () => {
    const input: RoomReportInput = { scenarioId: "adjust", consent: { A: true, B: true }, answers: {
      A: { expectation: "这周想和你出去走走，先少碰一点。", concern: "怕说慢点被当成以后一定会答应抱抱。",
        boundary: "今天不想抱，牵手还没想好，先问我。", response_next_step: "先一起走走。" },
      B: { expectation: "我也想一起走走，先陪着你。", concern: "怕老问会打断聊天。",
        boundary: "没问清楚就不抱也不牵。", response_next_step: "要碰之前我会先问。" },
    } };
    const ledger = structuredClone(touchLedger);
    ledger.facts[0]!.sourceSpan = "想和你出去走走";
    ledger.facts[1]!.sourceSpan = "想一起走走";
    ledger.facts[2]!.sourceSpan = "怕说慢点被当成以后一定会答应抱抱";
    ledger.facts[3]!.sourceSpan = "怕老问会打断聊天";
    ledger.facts[4]!.sourceSpan = "今天不想抱";
    ledger.facts[5]!.sourceSpan = "没问清楚就不抱也不牵";
    ledger.facts[6]!.sourceSpan = "要碰之前我会先问";
    expect(validateFactLedger(ledger, input).status).toBe("ready");

    const quotedInput = structuredClone(input);
    quotedInput.answers.A.boundary = "对方说今天不想抱；我还没决定。";
    expect(validateFactLedger(ledger, quotedInput).status).toBe("insufficient");

    const doubleNegative = structuredClone(input);
    doubleNegative.answers.A.boundary = "今天不是不想抱，牵手还没想好，先问我。";
    const doubleNegativeLedger = structuredClone(ledger);
    doubleNegativeLedger.facts[4]!.sourceSpan = "今天不是不想抱";
    expect(validateFactLedger(doubleNegativeLedger, doubleNegative).status).toBe("insufficient");

    const conditional = structuredClone(input);
    conditional.answers.A.boundary = "如果今天不想抱，牵手还没想好，先问我。";
    const conditionalLedger = structuredClone(ledger);
    conditionalLedger.facts[4]!.sourceSpan = "如果今天不想抱";
    expect(validateFactLedger(conditionalLedger, conditional).status).toBe("insufficient");
  });

  it("uses unresolved choice for opposing overnight stances, without calling either stance unknown", () => {
    const input: RoomReportInput = { scenarioId: "first-overnight", consent: { A: true, B: true }, answers: {
      A: { expectation: "想一起吃晚饭，但这次不想留宿。", concern: "担心结束太晚。", boundary: "晚饭后想回家。", response_next_step: "可以先定晚饭时间。" },
      B: { expectation: "想一起吃晚饭，也希望这次可以留宿。", concern: "担心安排太仓促。", boundary: "对方想回家就停。", response_next_step: "可以先定晚饭时间。" },
    } };
    const ledger = { version: "paired-facts-v0.1", scenarioId: "first-overnight", status: "ready", facts: [
      { id: "f1", owner: "A", answerId: "A.expectation", sourceSpan: "想一起吃晚饭", code: "wants_evening_together", scope: "current" },
      { id: "f2", owner: "B", answerId: "B.expectation", sourceSpan: "想一起吃晚饭", code: "wants_evening_together", scope: "current" },
      { id: "f3", owner: "A", answerId: "A.expectation", sourceSpan: "这次不想留宿", code: "no_overnight_now", scope: "current" },
      { id: "f4", owner: "B", answerId: "B.expectation", sourceSpan: "希望这次可以留宿", code: "wants_overnight", scope: "current" },
    ], relations: [
      { id: "r1", kind: "shared", topic: "activity", factIds: ["f1", "f2"] },
      { id: "r2", kind: "different", topic: "overnight", factIds: ["f3", "f4"] },
    ], openItems: [{ id: "u1", kind: "unresolved_choice", topic: "overnight", factIds: ["f3", "f4"] }] };
    expect(validateFactLedger(ledger, input).status).toBe("ready");
    const falseUnknown = structuredClone(ledger);
    falseUnknown.openItems = [{ id: "u1", kind: "one_sided_proposal", topic: "overnight", factId: "f3", missingSide: "B" }] as never;
    expect(() => validateFactLedger(falseUnknown, input)).toThrow("one-sided-proposal-already-answered");
  });

  it("renders a truthful ready report when there is a shared fact and no supported difference", async () => {
    const candidateLedger = candidate();
    candidateLedger.relations = candidateLedger.relations.filter(relation => relation.kind !== "different");
    const ledger = validateFactLedger(candidateLedger, sampleInput);
    expect(ledger.status).toBe("ready");
    if (ledger.status !== "ready") throw new Error("expected a ready ledger");
    const plan = structuredClone(samplePlan);
    plan.ledgerSha256 = await contentHash(ledger);
    plan.catalogSha256 = await contentHash(roomFactCatalog);
    plan.templatesSha256 = await contentHash(roomRenderTemplates);
    plan.sections.commonAndDifferences.differentRelationIds = [];
    plan.sections.adviceForBoth.discussionRelationIds = ["r1"];
    const report = await renderRoomReport(ledger, plan);
    expect(report.status).toBe("ready");
    if (report.status !== "ready") throw new Error("expected a ready report");
    expect(report.sections.commonAndDifferences.text).toContain("没有足够依据指出具体差异");
    expect(report.sections.adviceForBoth.text).toContain("核对已说清的安排，并保留各自的选择");
    expect(report.sections.adviceForBoth.text).not.toContain("不同的担忧");
    expect(report.sections.nextSteps.text).not.toContain("尚待确认");

    const omitted = structuredClone(samplePlan);
    omitted.sections.commonAndDifferences.differentRelationIds = [];
    await expect(validateReportPlan(omitted, validateFactLedger(sampleLedger, sampleInput) as typeof ledger)).rejects.toThrow("plan-difference-omitted-or-invented");
  });

  it("publishes a template report for two short, matching walk answers", async () => {
    const input: RoomReportInput = { scenarioId: "adjust", consent: { A: true, B: true }, answers: {
      A: { expectation: "想一起散步", concern: null, boundary: null, response_next_step: null },
      B: { expectation: "想一起散步", concern: null, boundary: null, response_next_step: null },
    } };
    const ledger = { version: "paired-facts-v0.1", scenarioId: "adjust", status: "ready", facts: [
      { id: "f1", owner: "A", answerId: "A.expectation", sourceSpan: "想一起散步", code: "wants_walk_together", scope: "current" },
      { id: "f2", owner: "B", answerId: "B.expectation", sourceSpan: "想一起散步", code: "wants_walk_together", scope: "current" },
    ], relations: [{ id: "r1", kind: "shared", topic: "activity", factIds: ["f1", "f2"] }], openItems: [] };
    const plan = { version: "paired-report-plan-v0.1", scenarioId: "adjust",
      ledgerSha256: await contentHash(ledger), catalogSha256: await contentHash(roomFactCatalog), templatesSha256: await contentHash(roomRenderTemplates),
      sections: { commonAndDifferences: { sharedOrCompatibleRelationIds: ["r1"], differentRelationIds: [] },
        adviceForBoth: { discussionRelationIds: ["r1"], cautionCodes: ["do_not_pressure"] },
        nextSteps: { actionCodes: ["walk_first"], boundaryFactIds: [], openItemIds: [] } } };
    let calls = 0;
    expect(insufficientReport(input)).toBeNull();
    const provider = createRoomReportProvider(async () => { calls += 1; return calls === 1 ? ledger : plan; });
    expect((await provider.generate(input, new AbortController().signal)).status).toBe("ready");
  });
});

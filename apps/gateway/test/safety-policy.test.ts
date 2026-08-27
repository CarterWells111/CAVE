import { describe, expect, it } from "vitest";

import { goldenSafetyCases } from "../../../packages/test-fixtures/src/golden";
import {
  createTurnSafetyEvaluator,
  evaluateSafety
} from "../src/security/safety-policy";

describe("deterministic safety policy", () => {
  it.each(goldenSafetyCases)("matches Golden case $id", ({ turns, expectedSafety }) => {
    expect(evaluateSafety({ turns, classification: "safe" })).toEqual(expectedSafety);
  });

  it("stops if roleplay pressures after a clear boundary", () => {
    expect(evaluateSafety({ classification: "safe", turns: [
      { role: "user", text: "我不能继续，我需要停下来。" },
      { role: "assistant", text: "别停，再做一点，你必须答应。" }
    ] })).toEqual({ level: "stop", reasonCode: "clear_boundary" });
  });

  it("maps uncertain classification to stop", () => {
    expect(evaluateSafety({ turns: [{ role: "user", text: "含义不清" }], classification: "uncertain" }))
      .toEqual({ level: "stop", reasonCode: "uncertain" });
  });

  it.each([
    "我不想活了。",
    "活着已经没有意思了。",
    "I am thinking about ending my life."
  ])("recognizes paraphrased self-harm disclosure: %s", (text) => {
    expect(evaluateSafety({
      turns: [{ role: "user", text }],
      classification: "safe"
    })).toEqual({
      level: "stop",
      reasonCode: "self_harm",
      resourceCategory: "self_harm"
    });
  });

  it.each([undefined, "uncertain" as const])(
    "fails closed when an explicit safe classification is absent: %s",
    (classification) => {
      expect(evaluateSafety({
        turns: [{ role: "user", text: "这句话的含义无法可靠判断。" }],
        ...(classification === undefined ? {} : { classification })
      })).toEqual({ level: "stop", reasonCode: "uncertain" });
    }
  );

  it.each([
    ["他刚打了我。", "violence", "violence"],
    ["他拿刀堵在门口。", "danger", "emergency"],
    ["我今年十七岁。", "minor", "minor"],
    ["我胸痛，而且嘴唇发紫。", "medical_emergency", "medical"],
    ["我不想活了。", "self_harm", "self_harm"]
  ] as const)(
    "classifies common safety disclosure in the integration evaluator: %s",
    async (userMessage, reasonCode, resourceCategory) => {
      await expect(createTurnSafetyEvaluator().evaluateTurn(
        { recentTurns: [], userMessage },
        new AbortController().signal
      )).resolves.toEqual({ level: "stop", reasonCode, resourceCategory });
    }
  );

  it("adapts directly to the Plan 03 turn safety injection interface", async () => {
    const evaluator = createTurnSafetyEvaluator();
    await expect(evaluator.evaluateTurn({
      recentTurns: [],
      userMessage: "这里出现了直接危险。"
    }, new AbortController().signal)).resolves.toMatchObject({
      level: "stop",
      reasonCode: "danger"
    });
  });

  it("recognizes an explicitly framed normal practice as safe", async () => {
    await expect(createTurnSafetyEvaluator().evaluateTurn({
      recentTurns: [],
      userMessage: "我想练习礼貌而清楚地拒绝额外请求。"
    }, new AbortController().signal)).resolves.toEqual({
      level: "safe",
      reasonCode: "none"
    });
  });

  it("fails closed for ambiguous or unknown text in the integration evaluator", async () => {
    await expect(createTurnSafetyEvaluator().evaluateTurn({
      recentTurns: [],
      userMessage: "含义不明确。"
    }, new AbortController().signal)).resolves.toEqual({
      level: "stop",
      reasonCode: "uncertain"
    });
  });
});

import { describe, expect, it } from "vitest";

import {
  normalizeDebriefDimensions,
  quoteAppearsInUserTurn
} from "../src/services/evidence";

describe("debrief evidence verification", () => {
  it("accepts a Unicode-normalized contiguous substring from a user turn", () => {
    expect(
      quoteAppearsInUserTurn("café", [
        { role: "user", text: "我说的是 cafe\u0301，明天再确认。" }
      ])
    ).toBe(true);
  });

  it("rejects assistant-only evidence", () => {
    expect(
      quoteAppearsInUserTurn("你可以拒绝", [
        { role: "assistant", text: "你可以拒绝" },
        { role: "user", text: "我知道了" }
      ])
    ).toBe(false);
  });

  it("removes forged quotes and marks the dimension not observed without regeneration", () => {
    expect(
      normalizeDebriefDimensions(
        [
          {
            key: "next_step",
            status: "expressed",
            evidenceQuote: "伪造的话",
            explanation: "已有说明"
          },
          {
            key: "feeling",
            status: "expressed",
            evidenceQuote: "我有一点紧张",
            explanation: "已有说明"
          },
          { key: "boundary", status: "not_observed", explanation: "未观察到" },
          { key: "willingness", status: "not_observed", explanation: "未观察到" }
        ],
        [{ role: "user", text: "我有一点紧张" }]
      )
    ).toEqual([
      {
        key: "feeling",
        status: "expressed",
        evidenceQuote: "我有一点紧张",
        explanation: "已有说明"
      },
      { key: "willingness", status: "not_observed", explanation: "未观察到" },
      { key: "boundary", status: "not_observed", explanation: "未观察到" },
      { key: "next_step", status: "not_observed", explanation: "已有说明" }
    ]);
  });

  it.each(["expressed", "could_be_clearer"])(
    "downgrades %s without a user evidence quote",
    (status) => {
      const dimensions = normalizeDebriefDimensions(
        [
          { key: "feeling", status, explanation: "missing evidence" },
          { key: "willingness", status: "not_observed", explanation: "none" },
          { key: "boundary", status: "not_observed", explanation: "none" },
          { key: "next_step", status: "not_observed", explanation: "none" }
        ],
        [{ role: "user", text: "我需要停下来" }]
      );

      expect(dimensions[0]).toEqual({
        key: "feeling",
        status: "not_observed",
        explanation: "missing evidence"
      });
    }
  );

  it("always removes contradictory evidence from not_observed", () => {
    const dimensions = normalizeDebriefDimensions(
      [
        {
          key: "feeling",
          status: "not_observed",
          evidenceQuote: "我需要停下来",
          explanation: "contradictory"
        },
        { key: "willingness", status: "not_observed", explanation: "none" },
        { key: "boundary", status: "not_observed", explanation: "none" },
        { key: "next_step", status: "not_observed", explanation: "none" }
      ],
      [{ role: "user", text: "我需要停下来" }]
    );

    expect(dimensions[0]).toEqual({
      key: "feeling",
      status: "not_observed",
      explanation: "contradictory"
    });
  });

  it.each([
    ["duplicate", ["feeling", "feeling", "boundary", "next_step"]],
    ["missing", ["feeling", "willingness", "boundary"]]
  ])("rejects %s dimensions", (_name, keys) => {
    expect(() =>
      normalizeDebriefDimensions(
        keys.map((key) => ({
          key,
          status: "not_observed",
          explanation: "未观察到"
        })),
        []
      )
    ).toThrow("dimensions");
  });
});

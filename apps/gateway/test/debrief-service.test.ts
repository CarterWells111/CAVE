import type { ModelProvider, ProviderDebriefInput } from "../src/providers/types";
import { createDebriefService } from "../src/services/debrief";
import {
  TEST_SCENARIO,
  VALID_DEBRIEF_REQUEST,
  scenarioSource
} from "./helpers";
import { describe, expect, it } from "vitest";

function candidate(overrides: Record<string, unknown> = {}) {
  const quote = VALID_DEBRIEF_REQUEST.turns[1]?.text ?? "";
  return {
    requestId: VALID_DEBRIEF_REQUEST.requestId,
    dimensions: [
      { key: "next_step", status: "expressed", evidenceQuote: quote, explanation: "下一步" },
      { key: "boundary", status: "expressed", evidenceQuote: quote, explanation: "边界" },
      { key: "willingness", status: "expressed", evidenceQuote: quote, explanation: "意愿" },
      { key: "feeling", status: "expressed", evidenceQuote: quote, explanation: "感受" }
    ],
    expressionCard: { boundary: "我需要停下来" },
    ...overrides
  };
}

function providerWith(value: unknown, capture?: (input: ProviderDebriefInput) => void): ModelProvider {
  return {
    async generateTurn() {
      throw new Error("not used");
    },
    async generateDebrief(input) {
      capture?.(input);
      return value;
    }
  };
}

describe("debrief service", () => {
  it("omits the installation token, canonicalizes order, and owns linked lessons", async () => {
    let input: ProviderDebriefInput | undefined;
    const service = createDebriefService({
      provider: providerWith(candidate(), (value) => {
        input = value;
      }),
      scenarioSource,
      promptVersion: "prompt-v1",
      policyVersion: "policy-v1"
    });

    const response = await service.execute(
      VALID_DEBRIEF_REQUEST,
      new AbortController().signal
    );

    expect(JSON.stringify(input)).not.toContain(VALID_DEBRIEF_REQUEST.installationToken);
    expect(response.dimensions.map((dimension) => dimension.key)).toEqual([
      "feeling",
      "willingness",
      "boundary",
      "next_step"
    ]);
    expect(response.linkedLessonIds).toEqual(TEST_SCENARIO.linkedLessonIds);
  });

  it.each([
    candidate({
      dimensions: [
        { key: "feeling", status: "not_observed", explanation: "a" },
        { key: "feeling", status: "not_observed", explanation: "b" },
        { key: "boundary", status: "not_observed", explanation: "c" },
        { key: "next_step", status: "not_observed", explanation: "d" }
      ]
    }),
    candidate({ dimensions: [] })
  ])("rejects duplicate or missing dimensions", async (invalid) => {
    const service = createDebriefService({
      provider: providerWith(invalid),
      scenarioSource,
      promptVersion: "prompt-v1",
      policyVersion: "policy-v1"
    });

    await expect(
      service.execute(VALID_DEBRIEF_REQUEST, new AbortController().signal)
    ).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
  });

  it("rejects debrief text denied by the server output guard", async () => {
    const service = createDebriefService({
      provider: providerWith(candidate()),
      scenarioSource,
      outputGuard() {
        return { ok: false, reason: "prompt_disclosure" };
      },
      promptVersion: "prompt-v1",
      policyVersion: "policy-v1"
    });

    await expect(
      service.execute(VALID_DEBRIEF_REQUEST, new AbortController().signal)
    ).rejects.toMatchObject({ code: "UNSAFE_CONTEXT", status: 502 });
  });

  it("does not return English generated explanation text", async () => {
    const english = candidate({ dimensions: [
      { key: "feeling", status: "not_observed", explanation: "You felt uncertain." },
      { key: "willingness", status: "not_observed", explanation: "意愿" },
      { key: "boundary", status: "not_observed", explanation: "边界" },
      { key: "next_step", status: "not_observed", explanation: "下一步" }
    ] });
    const service = createDebriefService({
      provider: providerWith(english), scenarioSource,
      promptVersion: "prompt-v1", policyVersion: "policy-v1"
    });
    await expect(service.execute(VALID_DEBRIEF_REQUEST, new AbortController().signal)).rejects.toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
  });

  it("preserves an English sentence only when it is the user's own exact quote", async () => {
    const quote = "I need a break.";
    const service = createDebriefService({
      provider: providerWith(candidate({ expressionCard: { boundary: quote } })), scenarioSource,
      promptVersion: "prompt-v1", policyVersion: "policy-v1"
    });
    const request = { ...VALID_DEBRIEF_REQUEST, turns: [...VALID_DEBRIEF_REQUEST.turns, { role: "user" as const, text: quote }] };
    await expect(service.execute(request, new AbortController().signal)).resolves.toMatchObject({ expressionCard: { boundary: quote } });
  });
});

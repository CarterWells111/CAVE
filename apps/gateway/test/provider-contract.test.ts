import {
  DebriefResponseSchema,
  PracticeTurnResponseSchema,
  type ScenarioStage
} from "@cave/contracts";
import { describe, expect, it } from "vitest";

import { MockProvider } from "../src/providers/mock";
import { OpenAICompatibleProvider } from "../src/providers/openai-compatible";
import {
  ProviderDebriefCandidateSchema,
  ProviderTurnCandidateSchema,
  type ModelProvider,
  type ProviderDebriefInput,
  type ProviderTurnInput
} from "../src/providers/types";
import { TEST_SCENARIO } from "./helpers";

function turnInput(stage: ScenarioStage = "setup"): ProviderTurnInput {
  return {
    requestId: "provider-turn-1",
    locale: "zh-CN",
    scenarioStage: stage,
    selectedOptions: { setting: "workplace" },
    recentTurns: [],
    userMessage: "我想练习拒绝。",
    scenario: structuredClone(TEST_SCENARIO),
    systemPrompt: "system",
    scenarioPrompt: "scenario"
  };
}

function debriefInput(): ProviderDebriefInput {
  return {
    requestId: "provider-debrief-1",
    locale: "zh-CN",
    turns: [{ role: "user", text: "我需要停下来，明天再确认。" }],
    scenario: structuredClone(TEST_SCENARIO),
    systemPrompt: "system",
    debriefPrompt: "debrief"
  };
}

function providerContract(name: string, makeProvider: () => ModelProvider) {
  describe(`${name} provider contract`, () => {
    it("honours an already-aborted signal", async () => {
      const controller = new AbortController();
      controller.abort("cancelled");

      await expect(
        makeProvider().generateTurn(turnInput(), controller.signal)
      ).rejects.toMatchObject({ name: "AbortError" });
    });

    it("honours an already-aborted signal for debrief", async () => {
      const controller = new AbortController();
      controller.abort("cancelled");

      await expect(
        makeProvider().generateDebrief(debriefInput(), controller.signal)
      ).rejects.toMatchObject({ name: "AbortError" });
    });

    it("returns strict schema-valid turn and debrief candidates with the request id", async () => {
      const provider = makeProvider();
      const signal = new AbortController().signal;
      const turn = ProviderTurnCandidateSchema.parse(
        await provider.generateTurn(turnInput(), signal)
      );
      const debrief = ProviderDebriefCandidateSchema.parse(
        await provider.generateDebrief(debriefInput(), signal)
      );

      expect(turn.requestId).toBe("provider-turn-1");
      expect(debrief.requestId).toBe("provider-debrief-1");
      expect(
        PracticeTurnResponseSchema.safeParse({
          contractVersion: "1",
          requestId: turn.requestId,
          roleMessage: turn.roleMessage,
          nextStage: turn.candidateStage,
          shouldEnd: false,
          safety: { level: "safe", reasonCode: "none" },
          promptVersion: "test-prompt",
          policyVersion: "test-policy"
        }).success
      ).toBe(true);
      expect(
        DebriefResponseSchema.safeParse({
          contractVersion: "1",
          requestId: debrief.requestId,
          dimensions: debrief.dimensions,
          expressionCard: debrief.expressionCard,
          linkedLessonIds: TEST_SCENARIO.linkedLessonIds,
          promptVersion: "test-prompt",
          policyVersion: "test-policy"
        }).success
      ).toBe(true);
    });

    it("does not mutate provider input", async () => {
      const provider = makeProvider();
      const input = turnInput();
      const before = structuredClone(input);

      await provider.generateTurn(input, new AbortController().signal);

      expect(input).toEqual(before);
    });

    it("does not mutate debrief provider input", async () => {
      const provider = makeProvider();
      const input = debriefInput();
      const before = structuredClone(input);

      await provider.generateDebrief(input, new AbortController().signal);

      expect(input).toEqual(before);
    });

    it("strictly rejects unknown turn and debrief candidate fields", async () => {
      const provider = makeProvider();
      const signal = new AbortController().signal;
      const turn = await provider.generateTurn(turnInput(), signal);
      const debrief = await provider.generateDebrief(debriefInput(), signal);

      expect(
        ProviderTurnCandidateSchema.safeParse({
          ...(turn as Record<string, unknown>),
          unknown: true
        }).success
      ).toBe(false);
      expect(
        ProviderDebriefCandidateSchema.safeParse({
          ...(debrief as Record<string, unknown>),
          unknown: true
        }).success
      ).toBe(false);
    });

    it("produces deterministic output keyed by scenario, stage, and turn count", async () => {
      const provider = makeProvider();
      const first = turnInput("response");
      first.recentTurns = [{ role: "user", text: "第一次" }];
      const second = structuredClone(first);

      await expect(
        provider.generateTurn(first, new AbortController().signal)
      ).resolves.toEqual(
        await provider.generateTurn(second, new AbortController().signal)
      );
    });
  });
}

providerContract("mock", () => new MockProvider());
providerContract(
  "live with mocked fetch",
  () =>
    new OpenAICompatibleProvider({
      baseUrl: "https://models.example.test/v1",
      apiKey: "test-secret",
      modelName: "model-a",
      fetch: async (_url, init) => {
        const request = JSON.parse(String(init?.body)) as {
          messages: Array<{ content: string }>;
        };
        const isDebrief = request.messages.some((message) =>
          message.content.includes("STRICT_DEBRIEF_CANDIDATE_SCHEMA=")
        );
        const content = isDebrief
          ? {
              requestId: "provider-debrief-1",
              dimensions: [
                {
                  key: "feeling",
                  status: "not_observed",
                  explanation: "not observed"
                },
                {
                  key: "willingness",
                  status: "not_observed",
                  explanation: "not observed"
                },
                {
                  key: "boundary",
                  status: "expressed",
                  evidenceQuote: "我需要停下来，明天再确认。",
                  explanation: "observed"
                },
                {
                  key: "next_step",
                  status: "expressed",
                  evidenceQuote: "明天再确认",
                  explanation: "observed"
                }
              ],
              expressionCard: { boundary: "我需要停下来" }
            }
          : {
              requestId: "provider-turn-1",
              roleMessage: "回应",
              candidateStage: "opening"
            };
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(content) } }]
          }),
          { status: 200 }
        );
      }
    })
);

describe("provider candidate schemas", () => {
  it("rejects unknown output fields", () => {
    expect(
      ProviderTurnCandidateSchema.safeParse({
        requestId: "candidate-1",
        roleMessage: "回应",
        candidateStage: "opening",
        stopCode: "clear_boundary"
      }).success
    ).toBe(false);
  });

  it("rejects oversized provider-authored text", () => {
    const oversized = "x".repeat(2001);

    expect(
      ProviderTurnCandidateSchema.safeParse({
        requestId: "candidate-1",
        roleMessage: oversized,
        candidateStage: "opening"
      }).success
    ).toBe(false);
    expect(
      ProviderDebriefCandidateSchema.safeParse({
        requestId: "candidate-1",
        dimensions: [
          {
            key: "feeling",
            status: "expressed",
            evidenceQuote: "evidence",
            explanation: oversized
          },
          { key: "willingness", status: "not_observed", explanation: "none" },
          { key: "boundary", status: "not_observed", explanation: "none" },
          { key: "next_step", status: "not_observed", explanation: "none" }
        ],
        expressionCard: {}
      }).success
    ).toBe(false);
    expect(
      ProviderDebriefCandidateSchema.safeParse({
        requestId: "candidate-1",
        dimensions: [
          { key: "feeling", status: "not_observed", explanation: "none" },
          { key: "willingness", status: "not_observed", explanation: "none" },
          { key: "boundary", status: "not_observed", explanation: "none" },
          { key: "next_step", status: "not_observed", explanation: "none" }
        ],
        expressionCard: { boundary: oversized }
      }).success
    ).toBe(false);
  });
});

describe("MockProvider deterministic key", () => {
  it("changes output when scenario stage or turn count changes", async () => {
    const provider = new MockProvider();
    const signal = new AbortController().signal;
    const setup = turnInput("setup");
    const opening = turnInput("opening");
    const later = turnInput("setup");
    later.recentTurns = [{ role: "user", text: "later" }];
    const otherScenario = turnInput("setup");
    otherScenario.scenario = {
      ...structuredClone(TEST_SCENARIO),
      id: "scenario-other"
    };

    const outputs = await Promise.all([
      provider.generateTurn(setup, signal),
      provider.generateTurn(opening, signal),
      provider.generateTurn(later, signal),
      provider.generateTurn(otherScenario, signal)
    ]);

    expect(new Set(outputs.map((value) => JSON.stringify(value))).size).toBe(4);
  });
});

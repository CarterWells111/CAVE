import type { DebriefKey, ScenarioStage } from "@cave/contracts";

import {
  assertNotAborted,
  type ModelProvider,
  type ProviderDebriefInput,
  type ProviderTurnInput
} from "./types";

const NEXT_STAGE: Record<ScenarioStage, ScenarioStage> = {
  setup: "opening",
  opening: "response",
  response: "clarification",
  clarification: "resolution",
  resolution: "resolution",
  debrief: "debrief",
  safety_stop: "safety_stop"
};

const DIMENSIONS: readonly DebriefKey[] = [
  "feeling",
  "willingness",
  "boundary",
  "next_step"
];

function userEvidence(input: ProviderDebriefInput): string | undefined {
  for (let index = input.turns.length - 1; index >= 0; index -= 1) {
    const turn = input.turns[index];
    if (turn?.role === "user") return turn.text;
  }
  return undefined;
}

export class MockProvider implements ModelProvider {
  async generateTurn(
    input: ProviderTurnInput,
    signal: AbortSignal
  ): Promise<unknown> {
    assertNotAborted(signal);
    const turnCount = input.recentTurns.filter(
      (turn) => turn.role === "user"
    ).length;
    const key = `${input.scenario.id}:${input.scenarioStage}:${turnCount}`;

    return {
      requestId: input.requestId,
      roleMessage: `Mock role response (${key})`,
      candidateStage: NEXT_STAGE[input.scenarioStage]
    };
  }

  async generateDebrief(
    input: ProviderDebriefInput,
    signal: AbortSignal
  ): Promise<unknown> {
    assertNotAborted(signal);
    const evidenceQuote = userEvidence(input);

    return {
      requestId: input.requestId,
      dimensions: DIMENSIONS.map((key) => ({
        key,
        status: evidenceQuote ? "expressed" : "not_observed",
        ...(evidenceQuote ? { evidenceQuote } : {}),
        explanation: evidenceQuote
          ? "Mock provider observed user evidence."
          : "Mock provider did not observe user evidence."
      })),
      expressionCard: evidenceQuote ? { boundary: evidenceQuote } : {}
    };
  }
}

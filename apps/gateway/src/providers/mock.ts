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

const STAGE_LABELS: Record<ScenarioStage, string> = {
  setup: "准备", opening: "开始", response: "回应", clarification: "澄清",
  resolution: "收尾", debrief: "回顾", safety_stop: "停止"
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
    const turnCount = input.recentTurns.filter(turn => turn.role === "user").length;
    return {
      requestId: input.requestId,
      roleMessage: `这是${input.scenario.title}的本机模拟练习（${STAGE_LABELS[input.scenarioStage]}，第${turnCount + 1}轮）。你可以继续表达自己的想法。`,
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
          ? "你在练习中表达了自己的想法。"
          : "这次练习中没有可引用的表达。"
      })),
      expressionCard: evidenceQuote ? { boundary: evidenceQuote } : {}
    };
  }
}

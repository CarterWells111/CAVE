import type {
  SafetyDecision,
  ScenarioConfig,
  ScenarioStage,
  StopRuleCode
} from "@hackathon/contracts";

import { isTerminalStage, resolveCandidateStage } from "./reducer";

export type ScenarioStopReason =
  | StopRuleCode
  | "policy_violation"
  | "uncertain";

export type ScenarioState = {
  stage: ScenarioStage;
  turnCount: number;
  terminal: boolean;
  stopReason?: ScenarioStopReason | undefined;
};

export type ScenarioEvent = {
  candidateStage: ScenarioStage;
  safety: SafetyDecision;
  stopCode?: StopRuleCode | undefined;
};

export function createScenarioState(config: ScenarioConfig): ScenarioState {
  const stage = config.allowedStages.includes("setup")
    ? "setup"
    : config.allowedStages[0];

  if (!stage) {
    throw new Error(`Scenario ${config.id} has no allowed stages`);
  }

  return {
    stage,
    turnCount: 0,
    terminal: isTerminalStage(stage)
  };
}

function terminalState(
  stage: "resolution" | "safety_stop",
  turnCount: number,
  stopReason: ScenarioStopReason
): ScenarioState {
  return { stage, turnCount, terminal: true, stopReason };
}

export function advanceScenario(
  config: ScenarioConfig,
  state: ScenarioState,
  event: ScenarioEvent
): ScenarioState {
  if (state.terminal || isTerminalStage(state.stage)) {
    return state;
  }

  const turnCount = state.turnCount + 1;

  if (event.safety.level === "stop") {
    const reasonCode =
      event.safety.reasonCode === "none" ? "uncertain" : event.safety.reasonCode;
    return terminalState("safety_stop", turnCount, reasonCode);
  }

  if (event.stopCode) {
    const stopRule = config.stopRules.find((rule) => rule.code === event.stopCode);
    if (stopRule) {
      return terminalState(stopRule.terminalStage, turnCount, stopRule.code);
    }
  }

  const maxTurnsRule = config.stopRules.find((rule) => rule.code === "max_turns");
  if (turnCount >= config.maxTurns && maxTurnsRule) {
    return terminalState(
      maxTurnsRule.terminalStage,
      turnCount,
      maxTurnsRule.code
    );
  }

  const stage = resolveCandidateStage(
    state.stage,
    event.candidateStage,
    config.allowedStages
  );

  return {
    stage,
    turnCount,
    terminal: isTerminalStage(stage)
  };
}

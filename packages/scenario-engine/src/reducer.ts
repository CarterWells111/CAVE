import type { ScenarioStage } from "@hackathon/contracts";

const CANDIDATE_TRANSITIONS: Record<ScenarioStage, readonly ScenarioStage[]> = {
  setup: ["opening"],
  opening: ["response"],
  response: ["response", "clarification", "resolution"],
  clarification: ["response", "clarification", "resolution"],
  resolution: [],
  debrief: ["debrief"],
  safety_stop: []
};

export function isTerminalStage(stage: ScenarioStage) {
  return stage === "resolution" || stage === "safety_stop";
}

export function resolveCandidateStage(
  currentStage: ScenarioStage,
  candidateStage: ScenarioStage,
  allowedStages: readonly ScenarioStage[]
) {
  if (candidateStage === "safety_stop" || !allowedStages.includes(candidateStage)) {
    return currentStage;
  }

  return CANDIDATE_TRANSITIONS[currentStage].includes(candidateStage)
    ? candidateStage
    : currentStage;
}

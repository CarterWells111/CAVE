import type { PracticeTurn, ScenarioConfig } from "@cave/contracts";

import { MAX_PROVIDER_TEXT_CHARS } from "./versions";

export const USER_DATA_START = "<CAVE_UNTRUSTED_USER_DATA>";
export const USER_DATA_END = "</CAVE_UNTRUSTED_USER_DATA>";

const SCENARIO_STAGES = [
  "setup",
  "opening",
  "response",
  "clarification",
  "resolution",
  "debrief",
  "safety_stop"
] as const;

type TurnData = {
  selectedOptions: Record<string, string>;
  recentTurns: PracticeTurn[];
  userMessage: string;
};

export function buildScenarioPrompt(scenario: ScenarioConfig): string {
  const serverScenario = {
    id: scenario.id,
    version: scenario.version,
    title: scenario.title,
    allowedStages: scenario.allowedStages,
    maxTurns: scenario.maxTurns,
    learningObjectives: scenario.learningObjectives,
    allowedPressureLevel: scenario.allowedPressureLevel,
    stopRules: scenario.stopRules
  };

  return [
    "SERVER_SCENARIO (validated, authoritative)",
    `allowedPressureLevel=${scenario.allowedPressureLevel}`,
    JSON.stringify(serverScenario),
    "candidateStage is advisory only; server domain logic owns the final stage."
  ].join("\n");
}

export function buildTurnResponseContract(requestId: string): string {
  return `STRICT_TURN_CANDIDATE_SCHEMA=${JSON.stringify({
    type: "object",
    additionalProperties: false,
    required: ["requestId", "roleMessage", "candidateStage"],
    properties: {
      requestId: { const: requestId },
      roleMessage: {
        type: "string",
        minLength: 1,
        maxLength: MAX_PROVIDER_TEXT_CHARS
      },
      candidateStage: { enum: SCENARIO_STAGES }
    }
  })}`;
}

function encodeUtf8Base64(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function buildTurnDataSection(data: TurnData): string {
  return [
    USER_DATA_START,
    "encoding=utf8-base64",
    `payload=${encodeUtf8Base64(data)}`,
    USER_DATA_END
  ].join("\n");
}

import type { PracticeTurn, ScenarioConfig } from "@cave/contracts";

import { USER_DATA_END, USER_DATA_START } from "./scenario";
import { MAX_PROVIDER_TEXT_CHARS } from "./versions";

export const DEBRIEF_DIMENSION_ORDER = [
  "feeling",
  "willingness",
  "boundary",
  "next_step"
] as const;

export function buildDebriefPrompt(scenario: ScenarioConfig): string {
  return [
    `SERVER_DEBRIEF scenario=${scenario.id}@${scenario.version}`,
    `dimensions=${DEBRIEF_DIMENSION_ORDER.join(",")}`,
    "Return every dimension exactly once in the listed order.",
    "evidenceQuote must be a contiguous substring of a user turn; assistant text is never evidence.",
    "Do not invent dialogue or evidence. Return JSON only."
  ].join("\n");
}

export function buildDebriefResponseContract(requestId: string): string {
  const dimension = {
    type: "object",
    additionalProperties: false,
    required: ["key", "status", "explanation"],
    properties: {
      key: { enum: DEBRIEF_DIMENSION_ORDER },
      status: { enum: ["expressed", "could_be_clearer", "not_observed"] },
      evidenceQuote: {
        type: "string",
        minLength: 1,
        maxLength: MAX_PROVIDER_TEXT_CHARS
      },
      explanation: {
        type: "string",
        minLength: 1,
        maxLength: MAX_PROVIDER_TEXT_CHARS
      },
      optionalAlternative: {
        type: "string",
        minLength: 1,
        maxLength: MAX_PROVIDER_TEXT_CHARS
      }
    }
  };
  return `STRICT_DEBRIEF_CANDIDATE_SCHEMA=${JSON.stringify({
    type: "object",
    additionalProperties: false,
    required: ["requestId", "dimensions", "expressionCard"],
    properties: {
      requestId: { const: requestId },
      dimensions: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: dimension
      },
      expressionCard: {
        type: "object",
        additionalProperties: false,
        properties: {
          feeling: {
            type: "string",
            minLength: 1,
            maxLength: MAX_PROVIDER_TEXT_CHARS
          },
          willingness: {
            type: "string",
            minLength: 1,
            maxLength: MAX_PROVIDER_TEXT_CHARS
          },
          boundary: {
            type: "string",
            minLength: 1,
            maxLength: MAX_PROVIDER_TEXT_CHARS
          },
          nextStep: {
            type: "string",
            minLength: 1,
            maxLength: MAX_PROVIDER_TEXT_CHARS
          }
        }
      }
    }
  })}`;
}

function encodeUtf8Base64(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function buildDebriefDataSection(turns: PracticeTurn[]): string {
  return [
    USER_DATA_START,
    "encoding=utf8-base64",
    `payload=${encodeUtf8Base64({ turns })}`,
    USER_DATA_END
  ].join("\n");
}

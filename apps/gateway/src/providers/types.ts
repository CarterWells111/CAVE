import {
  DebriefDimensionSchema,
  ExpressionCardSchema,
  ScenarioStageSchema,
  type PracticeTurn,
  type ScenarioConfig,
  type ScenarioStage
} from "@cave/contracts";
import { z } from "zod";

import { MAX_PROVIDER_TEXT_CHARS } from "../prompts/versions";

export type ProviderTurnInput = {
  requestId: string;
  locale: "zh-CN";
  scenarioStage: ScenarioStage;
  selectedOptions: Record<string, string>;
  recentTurns: PracticeTurn[];
  userMessage: string;
  scenario: ScenarioConfig;
  systemPrompt: string;
  scenarioPrompt: string;
};

export type ProviderDebriefInput = {
  requestId: string;
  locale: "zh-CN";
  turns: PracticeTurn[];
  scenario: ScenarioConfig;
  systemPrompt: string;
  debriefPrompt: string;
};

export interface ModelProvider {
  generateTurn(input: ProviderTurnInput, signal: AbortSignal): Promise<unknown>;
  generateDebrief(
    input: ProviderDebriefInput,
    signal: AbortSignal
  ): Promise<unknown>;
}

const ProviderTextSchema = z.string().min(1).max(MAX_PROVIDER_TEXT_CHARS);
const ProviderDebriefDimensionSchema = DebriefDimensionSchema.extend({
  evidenceQuote: ProviderTextSchema.optional(),
  explanation: ProviderTextSchema,
  optionalAlternative: ProviderTextSchema.optional()
});
const ProviderExpressionCardSchema = ExpressionCardSchema.extend({
  feeling: ProviderTextSchema.optional(),
  willingness: ProviderTextSchema.optional(),
  boundary: ProviderTextSchema.optional(),
  nextStep: ProviderTextSchema.optional()
});

export type ProviderErrorCode =
  | "timeout"
  | "rate_limited"
  | "unavailable"
  | "invalid_response";

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly status?: number | undefined;
  readonly retryAfterSeconds?: number | undefined;

  constructor(
    code: ProviderErrorCode,
    options: { status?: number; retryAfterSeconds?: number } = {}
  ) {
    super(`Provider request failed (${code})`);
    this.name = "ProviderError";
    this.code = code;
    this.status = options.status;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export const ProviderTurnCandidateSchema = z
  .object({
    requestId: z.string().min(1),
    roleMessage: ProviderTextSchema,
    candidateStage: ScenarioStageSchema
  })
  .strict();

export const ProviderDebriefCandidateSchema = z
  .object({
    requestId: z.string().min(1),
    dimensions: z.array(ProviderDebriefDimensionSchema).length(4),
    expressionCard: ProviderExpressionCardSchema
  })
  .strict();

export type ProviderTurnCandidate = z.infer<
  typeof ProviderTurnCandidateSchema
>;
export type ProviderDebriefCandidate = z.infer<
  typeof ProviderDebriefCandidateSchema
>;

export function abortError(): DOMException {
  return new DOMException("The operation was aborted", "AbortError");
}

export function assertNotAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError();
}

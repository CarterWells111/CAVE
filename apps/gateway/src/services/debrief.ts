import {
  DebriefRequestSchema,
  DebriefResponseSchema,
  type DebriefResponse,
  type ScenarioConfig
} from "@cave/contracts";

import { GatewayError } from "../errors/map-error";
import { buildDebriefPrompt } from "../prompts/debrief";
import { buildSystemPrompt } from "../prompts/system";
import {
  InvalidModelOutputError,
  parseProviderOutput,
  preserveStructuredFields,
  type JsonRepairer
} from "../providers/repair";
import {
  ProviderDebriefCandidateSchema,
  type ModelProvider,
  type ProviderDebriefInput
} from "../providers/types";
import { normalizeDebriefDimensions } from "./evidence";
import type { ScenarioSource } from "./turn";

type DebriefServiceDependencies = {
  provider: ModelProvider;
  repairer?: JsonRepairer | undefined;
  scenarioSource: ScenarioSource;
  promptVersion: string;
  policyVersion: string;
};

export interface DebriefService {
  execute(value: unknown, signal: AbortSignal): Promise<DebriefResponse>;
}

function parseRequest(value: unknown) {
  const parsed = DebriefRequestSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  if (
    typeof value === "object" &&
    value !== null &&
    "contractVersion" in value &&
    value.contractVersion !== "1"
  ) {
    throw new GatewayError("CONTRACT_MISMATCH", 400);
  }
  throw new GatewayError("INVALID_REQUEST", 400);
}

function resolveScenario(
  source: ScenarioSource,
  id: string,
  version: number
): ScenarioConfig {
  const scenario = source.getScenario(id);
  if (!scenario || scenario.version !== version) {
    throw new GatewayError("INVALID_REQUEST", 400);
  }
  return scenario;
}

export function createDebriefService(
  dependencies: DebriefServiceDependencies
): DebriefService {
  return {
    async execute(value, signal) {
      const request = parseRequest(value);
      const scenario = resolveScenario(
        dependencies.scenarioSource,
        request.scenarioId,
        request.scenarioVersion
      );
      const providerInput: ProviderDebriefInput = {
        requestId: request.requestId,
        locale: request.locale,
        turns: structuredClone(request.turns),
        scenario: structuredClone(scenario),
        systemPrompt: buildSystemPrompt(
          dependencies.promptVersion,
          dependencies.policyVersion
        ),
        debriefPrompt: buildDebriefPrompt(scenario)
      };
      const rawCandidate = await dependencies.provider.generateDebrief(
        providerInput,
        signal
      );
      const candidate = await parseProviderOutput({
        raw: rawCandidate,
        schema: ProviderDebriefCandidateSchema,
        schemaDescription:
          "strict JSON object {requestId:string,dimensions:four DebriefDimension values,expressionCard:ExpressionCard}",
        ...(dependencies.repairer ? { repairer: dependencies.repairer } : {}),
        repairPolicy: {
          preserve: preserveStructuredFields([
            "requestId",
            "dimensions",
            "expressionCard"
          ])
        },
        signal
      });
      if (candidate.requestId !== request.requestId) {
        throw new InvalidModelOutputError();
      }

      let dimensions;
      try {
        dimensions = normalizeDebriefDimensions(
          candidate.dimensions,
          request.turns
        );
      } catch {
        throw new InvalidModelOutputError();
      }

      return DebriefResponseSchema.parse({
        contractVersion: "1",
        requestId: request.requestId,
        dimensions,
        expressionCard: candidate.expressionCard,
        linkedLessonIds: structuredClone(scenario.linkedLessonIds),
        promptVersion: dependencies.promptVersion,
        policyVersion: dependencies.policyVersion
      });
    }
  };
}

import {
  PracticeTurnRequestSchema,
  PracticeTurnResponseSchema,
  SafetyDecisionSchema,
  type PracticeTurn,
  type PracticeTurnResponse,
  type SafetyDecision,
  type ScenarioConfig,
  type ScenarioStage
} from "@cave/contracts";
import { advanceScenario } from "@cave/scenario-engine";

import { GatewayError } from "../errors/map-error";
import { buildScenarioPrompt } from "../prompts/scenario";
import { buildSystemPrompt } from "../prompts/system";
import {
  InvalidModelOutputError,
  parseProviderOutput,
  preserveStructuredFields,
  type JsonRepairer
} from "../providers/repair";
import {
  ProviderTurnCandidateSchema,
  type ModelProvider,
  type ProviderTurnInput
} from "../providers/types";
import {
  guardModelOutput,
  type OutputGuard
} from "../security/output-guard";

export interface ScenarioSource {
  getScenario(id: string): ScenarioConfig | undefined;
}

export type TurnSafetyInput = {
  requestId: string;
  locale: "zh-CN";
  scenario: ScenarioConfig;
  scenarioStage: ScenarioStage;
  recentTurns: PracticeTurn[];
  userMessage: string;
};

export interface TurnSafetyEvaluator {
  evaluateTurn(
    input: TurnSafetyInput,
    signal: AbortSignal
  ): Promise<SafetyDecision>;
}

type TurnServiceDependencies = {
  provider: ModelProvider;
  repairer?: JsonRepairer | undefined;
  scenarioSource: ScenarioSource;
  safety: TurnSafetyEvaluator;
  outputGuard?: OutputGuard | undefined;
  promptVersion: string;
  policyVersion: string;
};

export interface TurnService {
  execute(value: unknown, signal: AbortSignal): Promise<PracticeTurnResponse>;
}

function parseRequest(value: unknown) {
  const parsed = PracticeTurnRequestSchema.safeParse(value);
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
  scenarioId: string,
  scenarioVersion: number,
  scenarioStage: ScenarioStage
): ScenarioConfig {
  const scenario = source.getScenario(scenarioId);
  if (!scenario || scenario.version !== scenarioVersion) {
    throw new GatewayError("INVALID_REQUEST", 400);
  }
  if (
    !scenario.allowedStages.includes(scenarioStage) ||
    scenarioStage === "debrief" ||
    scenarioStage === "resolution" ||
    scenarioStage === "safety_stop"
  ) {
    throw new GatewayError("INVALID_REQUEST", 400);
  }
  return scenario;
}

export function createTurnService(
  dependencies: TurnServiceDependencies
): TurnService {
  return {
    async execute(value, signal) {
      const request = parseRequest(value);
      const scenario = resolveScenario(
        dependencies.scenarioSource,
        request.scenarioId,
        request.scenarioVersion,
        request.scenarioStage
      );
      const safetyResult = SafetyDecisionSchema.safeParse(
        await dependencies.safety.evaluateTurn(
          {
            requestId: request.requestId,
            locale: request.locale,
            scenario: structuredClone(scenario),
            scenarioStage: request.scenarioStage,
            recentTurns: structuredClone(request.recentTurns),
            userMessage: request.userMessage
          },
          signal
        )
      );
      if (!safetyResult.success) {
        throw new GatewayError("INTERNAL_ERROR", 500);
      }
      const safety = safetyResult.data;
      const turnCount = request.recentTurns.filter(
        (turn) => turn.role === "user"
      ).length;
      const state = {
        stage: request.scenarioStage,
        turnCount,
        terminal: false
      };

      if (safety.level === "stop") {
        const next = advanceScenario(scenario, state, {
          candidateStage: request.scenarioStage,
          safety
        });
        return PracticeTurnResponseSchema.parse({
          contractVersion: "1",
          requestId: request.requestId,
          roleMessage: "Practice stopped by the server safety policy.",
          nextStage: next.stage,
          shouldEnd: next.terminal,
          safety,
          promptVersion: dependencies.promptVersion,
          policyVersion: dependencies.policyVersion
        });
      }

      const providerInput: ProviderTurnInput = {
        requestId: request.requestId,
        locale: request.locale,
        scenarioStage: request.scenarioStage,
        selectedOptions: structuredClone(request.selectedOptions),
        recentTurns: structuredClone(request.recentTurns),
        userMessage: request.userMessage,
        scenario: structuredClone(scenario),
        systemPrompt: buildSystemPrompt(
          dependencies.promptVersion,
          dependencies.policyVersion
        ),
        scenarioPrompt: buildScenarioPrompt(scenario)
      };
      const rawCandidate = await dependencies.provider.generateTurn(
        providerInput,
        signal
      );
      const candidate = await parseProviderOutput({
        raw: rawCandidate,
        schema: ProviderTurnCandidateSchema,
        schemaDescription:
          "strict JSON object {requestId:string,roleMessage:string,candidateStage:ScenarioStage}",
        ...(dependencies.repairer ? { repairer: dependencies.repairer } : {}),
        repairPolicy: {
          preserve: preserveStructuredFields([
            "requestId",
            "roleMessage",
            "candidateStage"
          ])
        },
        signal
      });
      if (candidate.requestId !== request.requestId) {
        throw new InvalidModelOutputError();
      }
      const next = advanceScenario(scenario, state, {
        candidateStage: candidate.candidateStage,
        safety
      });
      const guarded = (dependencies.outputGuard ?? guardModelOutput)(
        {
          roleMessage: candidate.roleMessage,
          nextStage: next.stage,
          safety
        },
        request.scenarioStage
      );
      if (!guarded.ok) {
        throw new GatewayError("UNSAFE_CONTEXT", 502);
      }

      return PracticeTurnResponseSchema.parse({
        contractVersion: "1",
        requestId: request.requestId,
        roleMessage: guarded.value.roleMessage,
        nextStage: guarded.value.nextStage,
        shouldEnd: next.terminal,
        safety,
        promptVersion: dependencies.promptVersion,
        policyVersion: dependencies.policyVersion
      });
    }
  };
}

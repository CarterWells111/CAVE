import { loadCatalog, validateCatalog } from "@hackathon/content";
import {
  ApiErrorResponseSchema,
  DebriefResponseSchema,
  PracticeTurnRequestSchema,
  SafetyDecisionSchema,
  type StopRuleCode
} from "@hackathon/contracts";
import {
  advanceScenario,
  createScenarioState,
  type ScenarioEvent
} from "@hackathon/scenario-engine";
import { describe, expect, it } from "vitest";

import {
  goldenSafetyCases,
  invalidContractCases,
  mockTurnSequence,
  validDebrief,
  validPracticeRequest
} from "./index";

const stopRuleCodes = new Set<StopRuleCode>([
  "explicit_exit",
  "max_turns",
  "clear_boundary",
  "danger",
  "violence",
  "self_harm",
  "medical_emergency",
  "minor"
]);

describe("offline domain fixtures", () => {
  it("runs learn to practice to debrief without UI or network", () => {
    const catalog = validateCatalog(loadCatalog(), { mode: "draft" });
    const course = catalog.courses[0]!;
    const lesson = catalog.lessons.find((item) => item.id === course.moduleIds[0])!;
    const scenario = catalog.scenarios.find(
      (item) => item.id === validPracticeRequest.scenarioId
    )!;

    expect(lesson.linkedScenarioIds).toContain(scenario.id);
    expect(PracticeTurnRequestSchema.parse(validPracticeRequest)).toEqual(
      validPracticeRequest
    );

    const finalState = mockTurnSequence.reduce(
      (state, event) => advanceScenario(scenario, state, event),
      createScenarioState(scenario)
    );

    expect(finalState).toMatchObject({ stage: "resolution", terminal: true });
    expect(DebriefResponseSchema.parse(validDebrief)).toEqual(validDebrief);
    expect(validDebrief.dimensions.map((dimension) => dimension.key)).toEqual(
      scenario.debriefRubric.dimensions
    );
  });

  it.each(invalidContractCases)("rejects $id", ({ kind, value }) => {
    const schema = {
      "api-error": ApiErrorResponseSchema,
      "practice-request": PracticeTurnRequestSchema,
      "safety-decision": SafetyDecisionSchema
    }[kind];

    expect(schema.safeParse(value).success).toBe(false);
  });

  it.each(goldenSafetyCases)("matches golden outcome $id", (goldenCase) => {
    const catalog = loadCatalog();
    const scenario = catalog.scenarios.find(
      (item) => item.id === goldenCase.scenarioId
    )!;
    const reasonCode = goldenCase.expectedSafety.reasonCode;
    const stopCode =
      goldenCase.expectedSafety.level === "stop" && stopRuleCodes.has(reasonCode as StopRuleCode)
        ? (reasonCode as StopRuleCode)
        : goldenCase.expectedFinalStage === "resolution"
          ? "clear_boundary"
          : undefined;
    const event: ScenarioEvent = {
      candidateStage: "response",
      safety: goldenCase.expectedSafety,
      ...(stopCode ? { stopCode } : {})
    };

    const state = advanceScenario(
      scenario,
      { stage: "response", turnCount: 0, terminal: false },
      event
    );

    expect(state.stage).toBe(goldenCase.expectedFinalStage);
    expect(SafetyDecisionSchema.parse(goldenCase.expectedSafety)).toEqual(
      goldenCase.expectedSafety
    );
    expect(goldenCase.expectedDebriefKeys).toEqual(
      scenario.debriefRubric.dimensions
    );
  });
});

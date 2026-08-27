import type {
  SafetyDecision,
  ScenarioConfig,
  StopRuleCode
} from "@cave/contracts";
import { describe, expect, it } from "vitest";

import { advanceScenario, createScenarioState } from "./machine";

const config: ScenarioConfig = {
  id: "scenario-boundary",
  version: 1,
  title: "拒绝额外请求",
  allowedStages: [
    "setup",
    "opening",
    "response",
    "clarification",
    "resolution",
    "debrief",
    "safety_stop"
  ],
  maxTurns: 4,
  learningObjectives: ["表达边界"],
  allowedPressureLevel: 1,
  stopRules: [
    { code: "explicit_exit", terminalStage: "resolution" },
    { code: "max_turns", terminalStage: "resolution" },
    { code: "clear_boundary", terminalStage: "resolution" },
    { code: "danger", terminalStage: "safety_stop" },
    { code: "violence", terminalStage: "safety_stop" },
    { code: "self_harm", terminalStage: "safety_stop" },
    { code: "medical_emergency", terminalStage: "safety_stop" },
    { code: "minor", terminalStage: "safety_stop" }
  ],
  debriefRubric: {
    dimensions: ["feeling", "willingness", "boundary", "next_step"]
  },
  linkedLessonIds: ["lesson-boundaries"],
  reviewStatus: "draft",
  sourceRefs: ["source-editorial-draft"]
};

const safe: SafetyDecision = { level: "safe", reasonCode: "none" };

describe("deterministic scenario engine", () => {
  it("starts at setup with zero turns", () => {
    expect(createScenarioState(config)).toEqual({
      stage: "setup",
      turnCount: 0,
      terminal: false
    });
  });

  it.each([
    ["setup", "opening"],
    ["opening", "response"],
    ["response", "clarification"]
  ] as const)("allows %s to advance to %s", (stage, candidateStage) => {
    expect(
      advanceScenario(
        config,
        { stage, turnCount: 0, terminal: false },
        { candidateStage, safety: safe }
      )
    ).toMatchObject({ stage: candidateStage, turnCount: 1, terminal: false });
  });

  it("rejects an illegal backwards transition", () => {
    expect(
      advanceScenario(
        config,
        { stage: "response", turnCount: 1, terminal: false },
        { candidateStage: "opening", safety: safe }
      )
    ).toMatchObject({ stage: "response", turnCount: 2, terminal: false });
  });

  it.each(["explicit_exit", "clear_boundary"] as const)(
    "ends in resolution for %s",
    (stopCode) => {
      expect(
        advanceScenario(
          config,
          { stage: "response", turnCount: 1, terminal: false },
          { candidateStage: "response", safety: safe, stopCode }
        )
      ).toMatchObject({ stage: "resolution", terminal: true, stopReason: stopCode });
    }
  );

  it("ends at maxTurns after counting the current event", () => {
    expect(
      advanceScenario(
        config,
        { stage: "response", turnCount: 3, terminal: false },
        { candidateStage: "response", safety: safe }
      )
    ).toMatchObject({
      stage: "resolution",
      turnCount: 4,
      terminal: true,
      stopReason: "max_turns"
    });
  });

  it.each([
    "danger",
    "violence",
    "self_harm",
    "medical_emergency",
    "minor"
  ] as const)("forces safety_stop for %s", (reasonCode) => {
    expect(
      advanceScenario(
        config,
        { stage: "response", turnCount: 1, terminal: false },
        {
          candidateStage: "response",
          safety: { level: "stop", reasonCode },
          stopCode: reasonCode
        }
      )
    ).toMatchObject({
      stage: "safety_stop",
      terminal: true,
      stopReason: reasonCode
    });
  });

  it("normalizes an impossible stop-none decision to uncertain", () => {
    expect(
      advanceScenario(
        config,
        { stage: "response", turnCount: 1, terminal: false },
        {
          candidateStage: "response",
          safety: { level: "stop", reasonCode: "none" }
        }
      )
    ).toMatchObject({
      stage: "safety_stop",
      terminal: true,
      stopReason: "uncertain"
    });
  });

  it("does not let a safe model candidate trigger safety_stop", () => {
    expect(
      advanceScenario(
        config,
        { stage: "response", turnCount: 1, terminal: false },
        { candidateStage: "safety_stop", safety: safe }
      )
    ).toMatchObject({ stage: "response", terminal: false });
  });

  it.each(["resolution", "safety_stop"] as const)(
    "keeps %s terminal and idempotent",
    (stage) => {
      const terminalState = {
        stage,
        turnCount: 2,
        terminal: true,
        stopReason: (stage === "resolution" ? "explicit_exit" : "danger") as StopRuleCode
      };

      expect(
        advanceScenario(config, terminalState, {
          candidateStage: "opening",
          safety: safe
        })
      ).toBe(terminalState);
    }
  );
});

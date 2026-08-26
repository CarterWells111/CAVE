import * as contractExports from "@hackathon/contracts";
import type {
  ApiErrorCode,
  ApiErrorResponse,
  Course,
  DebriefDimension,
  DebriefKey,
  DebriefRequest,
  DebriefResponse,
  DebriefRubric,
  ExpressionCard,
  Lesson,
  LessonBlock,
  PracticeTurn,
  PracticeTurnRequest,
  PracticeTurnResponse,
  QuizQuestion,
  ReviewStatus,
  SafetyDecision,
  ScenarioConfig,
  ScenarioStage,
  StopRule,
  StopRuleCode
} from "@hackathon/contracts";
import { describe, expect, expectTypeOf, it } from "vitest";

type PublicTypeInventory = [
  ReviewStatus,
  ScenarioStage,
  LessonBlock,
  Course,
  Lesson,
  QuizQuestion,
  StopRuleCode,
  StopRule,
  DebriefKey,
  DebriefRubric,
  PracticeTurn,
  SafetyDecision,
  PracticeTurnRequest,
  PracticeTurnResponse,
  DebriefDimension,
  ExpressionCard,
  DebriefRequest,
  DebriefResponse,
  ApiErrorCode,
  ApiErrorResponse,
  ScenarioConfig
];

// @ts-expect-error v1 package exports intentionally block deep imports.
type DeepImport = typeof import("@hackathon/contracts/src/content");

describe("version one public contract surface", () => {
  it("exports only the frozen schema inventory", () => {
    expect(Object.keys(contractExports).sort()).toEqual(
      [
        "ApiErrorCodeSchema",
        "ApiErrorResponseSchema",
        "CourseSchema",
        "DebriefDimensionSchema",
        "DebriefKeySchema",
        "DebriefRequestSchema",
        "DebriefResponseSchema",
        "DebriefRubricSchema",
        "ExpressionCardSchema",
        "LessonBlockSchema",
        "LessonSchema",
        "PracticeTurnRequestSchema",
        "PracticeTurnResponseSchema",
        "PracticeTurnSchema",
        "QuizQuestionSchema",
        "ReviewStatusSchema",
        "SafetyDecisionSchema",
        "ScenarioConfigSchema",
        "ScenarioStageSchema",
        "StopRuleCodeSchema",
        "StopRuleSchema"
      ].sort()
    );
  });

  it("publishes the complete v1 type inventory", () => {
    expectTypeOf<PublicTypeInventory>().not.toBeNever();
    expectTypeOf<DeepImport>().toBeAny();
  });
});

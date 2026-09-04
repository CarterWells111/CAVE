import * as contractExports from "@cave/contracts";
import type {
  ApiErrorCode,
  ApiErrorResponse,
  AccountDeletionChallengeRequest,
  AccountDeletionGrantResponse,
  AccountDeletionRequest,
  AccountPreferences,
  AccountPreferencesResponse,
  UpdateAccountPreferencesRequest,
  AuthSessionResponse,
  Course,
  DebriefDimension,
  DebriefKey,
  DebriefRequest,
  DebriefResponse,
  DebriefRubric,
  ExpressionCard,
  EmailChallengeAccepted,
  EmailChallengeRequest,
  EmailChallengeVerifyRequest,
  Lesson,
  LessonBlock,
  PracticeTurn,
  PracticeTurnRequest,
  PracticeTurnResponse,
  LogoutSessionRequest,
  RefreshSessionRequest,
  QuizQuestion,
  ReviewStatus,
  SafetyDecision,
  ScenarioConfig,
  ScenarioStage,
  SessionTokens,
  StopRule,
  StopRuleCode
} from "@cave/contracts";
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
  EmailChallengeRequest,
  EmailChallengeAccepted,
  EmailChallengeVerifyRequest,
  SessionTokens,
  AuthSessionResponse,
  RefreshSessionRequest,
  LogoutSessionRequest,
  AccountDeletionChallengeRequest,
  AccountDeletionGrantResponse,
  AccountDeletionRequest,
  AccountPreferences,
  AccountPreferencesResponse,
  UpdateAccountPreferencesRequest,
  ScenarioConfig
];

// @ts-expect-error v1 package exports intentionally block deep imports.
type DeepImport = typeof import("@cave/contracts/src/content");

describe("version one public contract surface", () => {
  it("exports only the frozen schema inventory", () => {
    expect(Object.keys(contractExports).sort()).toEqual(
      [
        "ApiErrorCodeSchema",
        "ApiErrorResponseSchema",
        "AccountDeletionChallengeRequestSchema",
        "AccountDeletionGrantResponseSchema",
        "AccountDeletionRequestSchema",
        "AccountPreferencesSchema",
        "AccountPreferencesResponseSchema",
        "UpdateAccountPreferencesRequestSchema",
        "AuthSessionResponseSchema",
        "CourseSchema",
        "DebriefDimensionSchema",
        "DebriefKeySchema",
        "DebriefRequestSchema",
        "DebriefResponseSchema",
        "DebriefRubricSchema",
        "ExpressionCardSchema",
        "EmailChallengeAcceptedSchema",
        "EmailChallengeRequestSchema",
        "EmailChallengeVerifyRequestSchema",
        "LessonBlockSchema",
        "LessonSchema",
        "PracticeTurnRequestSchema",
        "PracticeTurnResponseSchema",
        "PracticeTurnSchema",
        "LogoutSessionRequestSchema",
        "QuizQuestionSchema",
        "ReviewStatusSchema",
        "SafetyDecisionSchema",
        "RefreshSessionRequestSchema",
        "ScenarioConfigSchema",
        "ScenarioStageSchema",
        "StopRuleCodeSchema",
        "StopRuleSchema",
        "SessionTokensSchema"
      ].sort()
    );
  });

  it("publishes the complete v1 type inventory", () => {
    expectTypeOf<PublicTypeInventory>().not.toBeNever();
    expectTypeOf<DeepImport>().toBeAny();
  });
});

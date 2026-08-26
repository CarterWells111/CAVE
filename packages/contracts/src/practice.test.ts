import { describe, expect, it } from "vitest";

import { ApiErrorResponseSchema } from "./errors";
import {
  DebriefRequestSchema,
  DebriefResponseSchema,
  PracticeTurnRequestSchema,
  PracticeTurnResponseSchema
} from "./practice";
import { SafetyDecisionSchema } from "./safety";

const validRequest = {
  contractVersion: "1",
  requestId: "request-1",
  installationToken: "installation-1",
  locale: "zh-CN",
  scenarioId: "scenario-boundary",
  scenarioVersion: 1,
  scenarioStage: "opening",
  selectedOptions: { place: "office" },
  recentTurns: [{ role: "assistant", text: "你能再帮我一次吗？" }],
  userMessage: "我今天不方便。"
};

const validResponse = {
  contractVersion: "1",
  requestId: "request-1",
  roleMessage: "我知道了。",
  nextStage: "resolution",
  shouldEnd: true,
  safety: { level: "safe", reasonCode: "none" },
  promptVersion: "2026-08-26.1",
  policyVersion: "2026-08-26.1"
};

describe("practice turn contracts", () => {
  it("accepts the fixed contract version, locale, and request boundaries", () => {
    expect(
      PracticeTurnRequestSchema.safeParse({
        ...validRequest,
        userMessage: "边".repeat(500),
        recentTurns: Array.from({ length: 8 }, (_, index) => ({
          role: index % 2 === 0 ? "user" : "assistant",
          text: `turn-${index}`
        }))
      }).success
    ).toBe(true);
  });

  it.each([
    { ...validRequest, contractVersion: "2" },
    { ...validRequest, locale: "en-US" },
    { ...validRequest, userMessage: "边".repeat(501) },
    {
      ...validRequest,
      recentTurns: Array.from({ length: 9 }, () => ({ role: "user", text: "x" }))
    }
  ])("rejects a request outside fixed boundaries", (request) => {
    expect(PracticeTurnRequestSchema.safeParse(request).success).toBe(false);
  });

  it("rejects extra response fields", () => {
    expect(
      PracticeTurnResponseSchema.safeParse({ ...validResponse, rawModel: "secret" })
        .success
    ).toBe(false);
  });
});

describe("safety and debrief contracts", () => {
  it.each([
    { level: "safe", reasonCode: "danger" },
    { level: "stop", reasonCode: "none" }
  ])("rejects inconsistent safety decisions", (decision) => {
    expect(SafetyDecisionSchema.safeParse(decision).success).toBe(false);
  });

  it("rejects an empty evidence quote", () => {
    const response = {
      contractVersion: "1",
      requestId: "request-2",
      dimensions: [
        {
          key: "boundary",
          status: "expressed",
          evidenceQuote: "",
          explanation: "表达了边界。"
        }
      ],
      expressionCard: { boundary: "我现在不愿意。" },
      linkedLessonIds: ["lesson-boundaries"],
      promptVersion: "2026-08-26.1",
      policyVersion: "2026-08-26.1"
    };

    expect(DebriefResponseSchema.safeParse(response).success).toBe(false);
  });

  it("parses valid debrief and API error envelopes", () => {
    expect(
      DebriefRequestSchema.safeParse({
        contractVersion: "1",
        requestId: "request-2",
        installationToken: "installation-1",
        locale: "zh-CN",
        scenarioId: "scenario-boundary",
        scenarioVersion: 1,
        turns: validRequest.recentTurns
      }).success
    ).toBe(true);

    expect(
      ApiErrorResponseSchema.safeParse({
        contractVersion: "1",
        requestId: "request-2",
        code: "RATE_LIMITED",
        messageKey: "errors.rateLimited",
        retryAfterSeconds: 30
      }).success
    ).toBe(true);
  });
});

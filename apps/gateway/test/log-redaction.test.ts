import { describe, expect, it } from "vitest";

import { mapProviderError, safeLogEvent } from "../src/observability/safe-log";
import { recordRequestMetrics } from "../src/observability/metrics";

const CANARY = "sensitive-canary-7fba5d";
const SAFE_REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";

describe("safe observability", () => {
  it("serializes only allowlisted metadata and drops sensitive fields", () => {
    const serialized = safeLogEvent({
      requestId: SAFE_REQUEST_ID,
      route: "turn",
      status: 200,
      latencyMs: 12,
      model: "model-a",
      providerMode: "mock",
      promptVersion: "p1",
      policyVersion: "s1",
      inputChars: 10,
      outputChars: 20,
      inputTokens: 3,
      outputTokens: 4,
      safetyReasonCode: "none",
      message: CANARY,
      text: CANARY,
      turns: [{ text: CANARY }],
      expressionCard: { boundary: CANARY },
      apiKey: CANARY,
      installationToken: CANARY,
      authorization: `Bearer ${CANARY}`
    });
    expect(serialized).not.toContain(CANARY);
    expect(JSON.parse(serialized)).toEqual({
      requestId: SAFE_REQUEST_ID,
      route: "turn",
      status: 200,
      latencyMs: 12,
      model: "model-a",
      providerMode: "mock",
      promptVersion: "p1",
      policyVersion: "s1",
      inputChars: 10,
      outputChars: 20,
      inputTokens: 3,
      outputTokens: 4,
      safetyReasonCode: "none"
    });
  });

  it("does not allow sensitive text to be smuggled through requestId", () => {
    const serialized = safeLogEvent({ requestId: CANARY, route: "turn", status: 400 });
    expect(serialized).not.toContain(CANARY);
    expect(JSON.parse(serialized)).toEqual({
      requestId: "invalid-request-id",
      route: "turn",
      status: 400
    });
  });

  it("does not copy provider bodies or Error messages", () => {
    expect(JSON.stringify(mapProviderError(new Error(CANARY)))).not.toContain(CANARY);
    expect(JSON.stringify(mapProviderError({ body: CANARY, status: 503 }))).not.toContain(CANARY);
  });

  it("records only numeric request metrics", () => {
    expect(recordRequestMetrics({
      input: `private ${CANARY}`,
      output: CANARY,
      usage: { inputTokens: 2, outputTokens: 3 }
    })).toEqual({ inputChars: 31, outputChars: 23, inputTokens: 2, outputTokens: 3 });
  });
});

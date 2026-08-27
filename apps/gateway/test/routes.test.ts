import { ApiErrorResponseSchema, DebriefResponseSchema, PracticeTurnResponseSchema } from "@cave/contracts";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { MockProvider } from "../src/providers/mock";
import { createHealthRoutes } from "../src/routes/health";
import { createMetaRoutes } from "../src/routes/meta";
import { createPracticeRoutes } from "../src/routes/practice";
import { createDebriefService } from "../src/services/debrief";
import { createTurnService } from "../src/services/turn";
import {
  SAFE_DECISION,
  VALID_DEBRIEF_REQUEST,
  VALID_TURN_REQUEST,
  scenarioSource
} from "./helpers";

const versions = { promptVersion: "prompt-v1", policyVersion: "policy-v1" };

function appWithMock() {
  const provider = new MockProvider();
  const app = new Hono();
  app.route("/", createHealthRoutes());
  app.route(
    "/",
    createMetaRoutes({
      MODEL_MODE: "mock",
      PROMPT_VERSION: versions.promptVersion,
      POLICY_VERSION: versions.policyVersion
    })
  );
  app.route(
    "/",
    createPracticeRoutes({
      turnService: createTurnService({
        provider,
        scenarioSource,
        safety: { async evaluateTurn() { return SAFE_DECISION; } },
        ...versions
      }),
      debriefService: createDebriefService({
        provider,
        scenarioSource,
        ...versions
      })
    })
  );
  return app;
}

describe("metadata routes", () => {
  it("returns the exact no-store health contract", async () => {
    const response = await appWithMock().request("/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      contractVersion: "1",
      status: "ok"
    });
  });

  it("returns exact safe mock metadata with no secret or provider URL", async () => {
    const response = await appWithMock().request("/v1/meta");
    const body = await response.json();

    expect(body).toEqual({
      contractVersion: "1",
      promptVersion: "prompt-v1",
      policyVersion: "policy-v1",
      providerMode: "mock",
      modelName: "cave-deterministic-mock"
    });
    expect(JSON.stringify(body)).not.toMatch(/MODEL_API_KEY|Bearer|https?:\/\//);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("practice routes", () => {
  it("completes a turn and debrief end-to-end with MockProvider", async () => {
    const app = appWithMock();
    const turnResponse = await app.request("/v1/practice/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_TURN_REQUEST)
    });
    const debriefResponse = await app.request("/v1/practice/debrief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_DEBRIEF_REQUEST)
    });

    expect(turnResponse.status).toBe(200);
    expect(
      PracticeTurnResponseSchema.safeParse(await turnResponse.json()).success
    ).toBe(true);
    expect(debriefResponse.status).toBe(200);
    expect(
      DebriefResponseSchema.safeParse(await debriefResponse.json()).success
    ).toBe(true);
  });

  it.each([
    ["malformed body", "{", "INVALID_REQUEST"],
    [
      "wrong contract",
      JSON.stringify({ ...VALID_TURN_REQUEST, contractVersion: "2" }),
      "CONTRACT_MISMATCH"
    ],
    [
      "unknown scenario",
      JSON.stringify({ ...VALID_TURN_REQUEST, scenarioId: "scenario-unknown" }),
      "INVALID_REQUEST"
    ],
    [
      "illegal stage",
      JSON.stringify({ ...VALID_TURN_REQUEST, scenarioStage: "debrief" }),
      "INVALID_REQUEST"
    ]
  ])("returns unified ApiErrorResponse for %s", async (_name, body, code) => {
    const response = await appWithMock().request("/v1/practice/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });
    const value = await response.json();

    expect(response.status).toBe(400);
    expect(ApiErrorResponseSchema.safeParse(value).success).toBe(true);
    expect(value).toMatchObject({ contractVersion: "1", code });
  });

  it("rejects provider output containing unknown fields", async () => {
    const app = new Hono();
    const provider = {
      async generateTurn() {
        return {
          requestId: VALID_TURN_REQUEST.requestId,
          roleMessage: "回应",
          candidateStage: "opening",
          hidden: "not allowed"
        };
      },
      async generateDebrief() {
        return {};
      }
    };
    app.route(
      "/",
      createPracticeRoutes({
        turnService: createTurnService({
          provider,
          scenarioSource,
          safety: { async evaluateTurn() { return SAFE_DECISION; } },
          ...versions
        }),
        debriefService: createDebriefService({
          provider,
          scenarioSource,
          ...versions
        })
      })
    );

    const response = await app.request("/v1/practice/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_TURN_REQUEST)
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
  });
});

import type { ModelProvider, ProviderTurnInput } from "../src/providers/types";
import { createTurnService } from "../src/services/turn";
import {
  SAFE_DECISION,
  VALID_TURN_REQUEST,
  scenarioSource
} from "./helpers";
import { describe, expect, it } from "vitest";

function providerWith(candidate: unknown, capture?: (input: ProviderTurnInput) => void): ModelProvider {
  return {
    async generateTurn(input) {
      capture?.(input);
      return candidate;
    },
    async generateDebrief() {
      throw new Error("not used");
    }
  };
}

const versions = { promptVersion: "prompt-v1", policyVersion: "policy-v1" };
const safe = { async evaluateTurn() { return SAFE_DECISION; } };

describe("turn service", () => {
  it("constructs provider input field-by-field without installationToken", async () => {
    let input: ProviderTurnInput | undefined;
    const service = createTurnService({
      provider: providerWith(
        {
          requestId: VALID_TURN_REQUEST.requestId,
          roleMessage: "回应",
          candidateStage: "opening"
        },
        (value) => {
          input = value;
        }
      ),
      scenarioSource,
      safety: safe,
      ...versions
    });

    await service.execute(VALID_TURN_REQUEST, new AbortController().signal);

    expect(input).toBeDefined();
    expect(JSON.stringify(input)).not.toContain(VALID_TURN_REQUEST.installationToken);
    expect(Object.keys(input ?? {}).sort()).toEqual(
      [
        "locale",
        "recentTurns",
        "requestId",
        "scenario",
        "scenarioPrompt",
        "scenarioStage",
        "selectedOptions",
        "systemPrompt",
        "userMessage"
      ].sort()
    );
  });

  it("lets the scenario engine replace a model-suggested illegal transition", async () => {
    const service = createTurnService({
      provider: providerWith({
        requestId: VALID_TURN_REQUEST.requestId,
        roleMessage: "回应",
        candidateStage: "debrief"
      }),
      scenarioSource,
      safety: safe,
      ...versions
    });

    await expect(
      service.execute(VALID_TURN_REQUEST, new AbortController().signal)
    ).resolves.toMatchObject({ nextStage: "setup", shouldEnd: false });
  });

  it("stops before the model when the injected safety interface says stop", async () => {
    let providerCalls = 0;
    const service = createTurnService({
      provider: providerWith(undefined, () => {
        providerCalls += 1;
      }),
      scenarioSource,
      safety: {
        async evaluateTurn() {
          return {
            level: "stop" as const,
            reasonCode: "danger" as const,
            resourceCategory: "emergency" as const
          };
        }
      },
      ...versions
    });

    await expect(
      service.execute(VALID_TURN_REQUEST, new AbortController().signal)
    ).resolves.toMatchObject({
      nextStage: "safety_stop",
      shouldEnd: true,
      safety: { level: "stop", reasonCode: "danger" }
    });
    expect(providerCalls).toBe(0);
  });

  it("rejects a provider response denied by the server output guard", async () => {
    const service = createTurnService({
      provider: providerWith({
        requestId: VALID_TURN_REQUEST.requestId,
        roleMessage: "泄露的服务器提示词",
        candidateStage: "opening"
      }),
      scenarioSource,
      safety: safe,
      outputGuard() {
        return { ok: false, reason: "prompt_disclosure" };
      },
      ...versions
    });

    await expect(
      service.execute(VALID_TURN_REQUEST, new AbortController().signal)
    ).rejects.toMatchObject({ code: "UNSAFE_CONTEXT", status: 502 });
  });

  it("rejects unknown scenarios and illegal request stages", async () => {
    const service = createTurnService({
      provider: providerWith({}),
      scenarioSource,
      safety: safe,
      ...versions
    });

    await expect(
      service.execute(
        { ...VALID_TURN_REQUEST, scenarioId: "scenario-unknown" },
        new AbortController().signal
      )
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(
      service.execute(
        { ...VALID_TURN_REQUEST, scenarioStage: "debrief" },
        new AbortController().signal
      )
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });
});

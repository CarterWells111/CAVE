import { describe, expect, it, vi } from "vitest";

import worker from "./index";
import type { WorkerBindings } from "./app";
import {
  VALID_DEBRIEF_REQUEST,
  VALID_TURN_REQUEST
} from "../test/helpers";

function createWorkerEnv() {
  return {
    MODEL_MODE: "mock",
    PROMPT_VERSION: "2026-08-26.1",
    POLICY_VERSION: "2026-08-26.1",
    AUTH_DB: {} as D1Database,
    TURN_RATE_LIMITER: {
      limit: vi.fn(async () => ({ success: true }))
    },
    DEBRIEF_RATE_LIMITER: {
      limit: vi.fn(async () => ({ success: true }))
    }
  } satisfies WorkerBindings;
}

const executionContext = {
  waitUntil() {},
  passThroughOnException() {}
} as unknown as ExecutionContext;

async function requestWorker(
  path: string,
  env: WorkerBindings,
  body?: unknown
): Promise<Response> {
  if (!worker.fetch) throw new Error("missing Worker fetch handler");
  return await worker.fetch(
    new Request(`https://gateway.test${path}`, body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body)
        }),
    env,
    executionContext
  );
}

describe("gateway health route", () => {
  it("correlates logs only with bounded measurement markers", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      for (const marker of ["8129f8ee-85c2-4351-96bc-d2618b693134", "private-invalid-marker"]) {
        log.mockClear();
        await worker.fetch(new Request("https://gateway.test/v1/practice/turn", {
          method: "POST", headers: { "content-type": "application/json", "X-Cave-Measurement-Id": marker },
          body: JSON.stringify(VALID_TURN_REQUEST)
        }), createWorkerEnv(), executionContext);
        expect(log).toHaveBeenCalled();
        const entries = log.mock.calls.map(([line]) => JSON.parse(String(line)));
        expect(entries.every(entry => entry.measurementId === (marker.startsWith("8129") ? marker : undefined))).toBe(true);
      }
    } finally { log.mockRestore(); }
  });
  it("returns the versioned health contract", async () => {
    const response = await requestWorker("/health", createWorkerEnv());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      contractVersion: "1",
      status: "ok"
    });
  });

  it("forwards the configured env and selects independent Worker rate-limit bindings", async () => {
    const env = createWorkerEnv();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      const turn = await requestWorker(
        "/v1/practice/turn",
        env,
        VALID_TURN_REQUEST
      );
      const debrief = await requestWorker(
        "/v1/practice/debrief",
        env,
        VALID_DEBRIEF_REQUEST
      );

      expect(turn.status).toBe(200);
      expect(debrief.status).toBe(200);
      expect(env.TURN_RATE_LIMITER.limit).toHaveBeenCalledTimes(1);
      expect(env.DEBRIEF_RATE_LIMITER.limit).toHaveBeenCalledTimes(1);
    } finally {
      log.mockRestore();
    }
  });
});

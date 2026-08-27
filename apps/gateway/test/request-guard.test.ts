import { describe, expect, it } from "vitest";

import { guardPracticeRequest } from "../src/security/request-guard";

const validTurn = {
  contractVersion: "1",
  requestId: "request-1",
  installationToken: "random-installation-token",
  locale: "zh-CN",
  scenarioId: "scenario-boundary",
  scenarioVersion: 1,
  scenarioStage: "setup",
  selectedOptions: {},
  recentTurns: [],
  userMessage: "我想练习表达边界。"
};

function jsonRequest(value: unknown, headers: Record<string, string> = {}) {
  return new Request("https://gateway.test/v1/practice/turn", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(value)
  });
}

describe("guardPracticeRequest", () => {
  it("rejects non-JSON bodies", async () => {
    const result = await guardPracticeRequest(
      new Request("https://gateway.test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "hello"
      }),
      "turn",
      new Set(["scenario-boundary"])
    );
    expect(result).toMatchObject({ ok: false, status: 400, error: { code: "INVALID_REQUEST" } });
  });

  it("rejects bodies larger than 16 KiB before parsing", async () => {
    const result = await guardPracticeRequest(
      jsonRequest(validTurn, { "content-length": "16385" }),
      "turn",
      new Set(["scenario-boundary"])
    );
    expect(result).toMatchObject({ ok: false, status: 413, error: { code: "INVALID_REQUEST" } });
  });

  it("rejects a real oversized stream without Content-Length", async () => {
    const request = jsonRequest({ ...validTurn, userMessage: "x".repeat(17_000) });
    request.headers.delete("content-length");
    await expect(guardPracticeRequest(
      request,
      "turn",
      new Set(["scenario-boundary"])
    )).resolves.toMatchObject({ ok: false, status: 413 });
  });

  it("does not trust a lying small Content-Length header", async () => {
    const request = jsonRequest(
      { ...validTurn, userMessage: "x".repeat(17_000) },
      { "content-length": "1" }
    );
    await expect(guardPracticeRequest(
      request,
      "turn",
      new Set(["scenario-boundary"])
    )).resolves.toMatchObject({ ok: false, status: 413 });
  });

  it.each([
    ["contract-long message", { ...validTurn, userMessage: "x".repeat(501) }, "INVALID_REQUEST"],
    ["unknown field", { ...validTurn, injected: true }, "INVALID_REQUEST"],
    ["unsupported version", { ...validTurn, contractVersion: "2" }, "CONTRACT_MISMATCH"],
    ["unknown scenario", { ...validTurn, scenarioId: "unknown" }, "INVALID_REQUEST"]
  ])("rejects %s", async (_name, body, code) => {
    const result = await guardPracticeRequest(jsonRequest(body), "turn", new Set(["scenario-boundary"]));
    expect(result).toMatchObject({ ok: false, error: { code } });
  });

  it("returns a typed parsed request", async () => {
    const result = await guardPracticeRequest(jsonRequest(validTurn), "turn", new Set(["scenario-boundary"]));
    expect(result).toMatchObject({ ok: true, value: validTurn });
  });
});

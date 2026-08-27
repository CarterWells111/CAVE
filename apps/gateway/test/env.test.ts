import { describe, expect, it } from "vitest";

import { parseGatewayEnv } from "../src/env";

const versions = {
  PROMPT_VERSION: "2026-08-26.1",
  POLICY_VERSION: "2026-08-26.1"
};

describe("parseGatewayEnv", () => {
  it.each([
    [{ ...versions }, "MODEL_MODE"],
    [{ ...versions, MODEL_MODE: "other" }, "MODEL_MODE"],
    [{ MODEL_MODE: "mock", POLICY_VERSION: versions.POLICY_VERSION }, "PROMPT_VERSION"],
    [{ MODEL_MODE: "mock", PROMPT_VERSION: versions.PROMPT_VERSION }, "POLICY_VERSION"]
  ])("rejects an invalid mock environment %#", (value, field) => {
    expect(() => parseGatewayEnv(value)).toThrow(field);
  });

  it.each(["MODEL_BASE_URL", "MODEL_API_KEY", "MODEL_NAME"])(
    "requires %s in live mode",
    (missing) => {
      const value: Record<string, string> = {
        ...versions,
        MODEL_MODE: "live",
        MODEL_BASE_URL: "https://models.example.test/v1",
        MODEL_API_KEY: "server-secret",
        MODEL_NAME: "example-model"
      };
      delete value[missing];

      expect(() => parseGatewayEnv(value)).toThrow(missing);
    }
  );

  it("rejects a malformed live provider URL", () => {
    expect(() =>
      parseGatewayEnv({
        ...versions,
        MODEL_MODE: "live",
        MODEL_BASE_URL: "not a URL",
        MODEL_API_KEY: "server-secret",
        MODEL_NAME: "example-model"
      })
    ).toThrow("MODEL_BASE_URL");
  });

  it.each([
    ["MODEL_BASE_URL", "ftp://models.example.test/v1"],
    ["MODEL_API_KEY", "   "],
    ["MODEL_NAME", "   "]
  ])("rejects unsafe or blank live %s", (field, invalidValue) => {
    expect(() =>
      parseGatewayEnv({
        ...versions,
        MODEL_MODE: "live",
        MODEL_BASE_URL: "https://models.example.test/v1",
        MODEL_API_KEY: "server-secret",
        MODEL_NAME: "example-model",
        [field]: invalidValue
      })
    ).toThrow(field);
  });

  it.each([
    ["PROMPT_VERSION", "prompt-v1\nINJECTED"],
    ["PROMPT_VERSION", "prompt-v1\u0000suffix"],
    ["POLICY_VERSION", "policy-v1\rINJECTED"],
    ["POLICY_VERSION", "policy-v1\u001fsuffix"]
  ])("rejects control characters in %s", (field, invalidValue) => {
    expect(() =>
      parseGatewayEnv({
        MODEL_MODE: "mock",
        ...versions,
        [field]: invalidValue
      })
    ).toThrow(field);
  });

  it("normalizes a live URL without weakening the discriminated type", () => {
    expect(
      parseGatewayEnv({
        ...versions,
        MODEL_MODE: "live",
        MODEL_BASE_URL: "https://models.example.test/v1/",
        MODEL_API_KEY: "server-secret",
        MODEL_NAME: "example-model"
      })
    ).toEqual({
      ...versions,
      MODEL_MODE: "live",
      MODEL_BASE_URL: "https://models.example.test/v1",
      MODEL_API_KEY: "server-secret",
      MODEL_NAME: "example-model"
    });
  });
});

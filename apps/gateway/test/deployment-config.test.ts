import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseGatewayEnv } from "../src/env";
import packageJson from "../package.json";
const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
describe("shared deployed AI configuration", () => {
  it("pins the confirmed account and live model without embedding a key", () => {
    expect(config.account_id).toBe("3d3f8c9a0cd1392d912a00414155f7de");
    expect(config.vars).toMatchObject({ MODEL_MODE: "live", MODEL_BASE_URL: "https://api.deepseek.com", MODEL_NAME: "deepseek-v4-flash" });
    expect(config.vars).not.toHaveProperty("MODEL_API_KEY");
    expect(config.vars).toMatchObject({ ASSISTANT_HOURLY_LIMIT: "5", ASSISTANT_DAILY_LIMIT: "25" });
    expect(() => parseGatewayEnv(config.vars)).toThrow();
    expect(parseGatewayEnv({ ...config.vars, MODEL_API_KEY: "synthetic-test-key" }).MODEL_MODE).toBe("live");
  });
  it("keeps local gateway simulation explicit without changing deployed vars", () => {
    expect(packageJson.scripts.dev).toBe("wrangler dev --var MODEL_MODE:mock");
    expect(packageJson.scripts["dev:live"]).toBe("wrangler dev");
    expect(packageJson.scripts.deploy).toBe("wrangler deploy");
  });
});

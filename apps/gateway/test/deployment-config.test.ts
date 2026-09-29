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
  it("isolates staging routing, D1, rate limits and deployment commands", () => {
    const staging = config.env.staging;
    expect(staging.name).toBe("neijie-cave-gateway-staging");
    expect(staging.workers_dev).toBe(false);
    expect(staging.routes).toEqual([{ pattern: "staging-api.neijiecave.com", zone_name: "neijiecave.com", custom_domain: true }]);
    expect(staging.d1_databases).toEqual([{ binding: "AUTH_DB", database_name: "neijie-cave-auth-staging", database_id: "014af9e1-ebb2-4b46-aaf2-c9ce2b4de6e6", migrations_dir: "migrations" }]);
    expect(staging.d1_databases[0].database_id).not.toBe(config.d1_databases[0].database_id);
    expect(staging.vars).toMatchObject({ MODEL_MODE: "live", MODEL_BASE_URL: "https://api.deepseek.com", MODEL_NAME: "deepseek-v4-flash" });
    expect(staging.vars).not.toHaveProperty("MODEL_API_KEY");
    expect(() => parseGatewayEnv(staging.vars)).toThrow();
    expect(parseGatewayEnv({ ...staging.vars, MODEL_API_KEY: "synthetic-staging-key" }).MODEL_MODE).toBe("live");
    expect(new Set(staging.ratelimits.map((limit: { namespace_id: string }) => limit.namespace_id)).size).toBe(staging.ratelimits.length);
    expect(staging.ratelimits.map((limit: { namespace_id: string }) => limit.namespace_id)).not.toEqual(config.ratelimits.map((limit: { namespace_id: string }) => limit.namespace_id));
    expect(packageJson.scripts["deploy:staging"]).toBe("node scripts/run-staging.mjs deploy");
    expect(packageJson.scripts["migrate:staging"]).toBe("node scripts/run-staging.mjs migrate");
  });
});

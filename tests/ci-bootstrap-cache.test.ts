import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { INTERNAL_CHECKS } from "../scripts/verify-internal.mjs";

const workflow = parse(readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"));
const job = workflow.jobs.foundation;
const steps = job.steps;
const bootstrap = steps.find((step: { uses?: string }) => step.uses === "pnpm/action-setup@v6");

describe("CI bootstrap download reuse", () => {
  it("restores only content-addressed npm downloads before installing pnpm", () => {
    const cache = steps.find((step: { uses?: string }) => step.uses === "actions/cache@v4");
    expect(cache).toBeDefined();
    expect(cache.with.path).toBe("${{ runner.temp }}/cave-npm-bootstrap/_cacache");
    expect(cache.with.key).toBe("npm-bootstrap-v1-${{ runner.os }}-${{ runner.arch }}-${{ hashFiles('.github/workflows/ci.yml', '.nvmrc') }}");
    expect(cache.with["restore-keys"]).toBeUndefined();
    expect(steps.indexOf(cache)).toBeLessThan(steps.indexOf(bootstrap));
  });

  it("limits redundant npm audit and network preferences to the tool bootstrap step", () => {
    expect(bootstrap.env).toEqual({
      npm_config_cache: "${{ runner.temp }}/cave-npm-bootstrap",
      npm_config_prefer_offline: "true",
      npm_config_audit: "false",
      npm_config_fund: "false",
    });
    expect(workflow.env).toBeUndefined();
    expect(job.env).toBeUndefined();
    for (const step of steps.filter((step: unknown) => step !== bootstrap)) {
      expect(step.env?.npm_config_audit).toBeUndefined();
      expect(step.env?.NPM_CONFIG_AUDIT).toBeUndefined();
      expect(step.env?.npm_config_offline).toBeUndefined();
    }
  });

  it("never treats a cache hit as a reason to skip install, verification or fresh audit", () => {
    const install = steps.find((step: { run?: string }) => step.run === "pnpm install --frozen-lockfile");
    const verify = steps.find((step: { run?: string }) => step.run === "pnpm verify:internal");
    expect(install).toBeDefined();
    expect(verify).toBeDefined();
    for (const step of [bootstrap, install, verify]) {
      expect(step.if).toBeUndefined();
      expect(step["continue-on-error"]).toBeUndefined();
    }
    expect(bootstrap.with.version).toBe("10.34.5");
    expect(steps.find((step: { uses?: string }) => step.uses === "actions/setup-node@v7").with.cache).toBe("pnpm");
    expect(INTERNAL_CHECKS).toHaveLength(15);
    expect(INTERNAL_CHECKS.filter((args: string[]) => args[0] === "security:audit")).toEqual([["security:audit"]]);
  });
});

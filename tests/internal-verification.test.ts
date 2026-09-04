import { describe, expect, it } from "vitest";
import { INTERNAL_CHECKS, runChecks } from "../scripts/verify-internal.mjs";

describe("internal readiness gate", () => {
  it("records every check and fails the gate when a check fails or cannot start", async () => {
    const calls: string[][] = [];
    const report = await runChecks(async (args: string[]) => {
      calls.push(args);
      if (args[0] === "broken") throw new Error("could not start");
      return args[0] === "failed" ? 2 : 0;
    }, [["failed"], ["broken"], ["passed"]]);
    expect(calls).toHaveLength(3);
    expect(report.status).toBe("failed");
    expect(report.results.map((item: { exitCode: number }) => item.exitCode)).toEqual([2, 1, 0]);
  });
  it("passes only when all checks actually return zero", async () => {
    expect((await runChecks(async () => 0)).status).toBe("passed");
    expect(INTERNAL_CHECKS).toContainEqual(["validate:content:internal"]);
    expect(INTERNAL_CHECKS).not.toContainEqual(["validate:content"]);
    expect(INTERNAL_CHECKS).toContainEqual(["verify:mobile-policy"]);
    expect(INTERNAL_CHECKS).toContainEqual(["build:web"]);
    expect(INTERNAL_CHECKS).toContainEqual(["verify:acceptance-isolation"]);
    expect(INTERNAL_CHECKS).toContainEqual(["--filter", "@cave/mobile", "export:acceptance"]);
  });
});

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import packageJson from "../package.json";
import contentPackageJson from "../packages/content/package.json";

describe("foundation CI workflow", () => {
  it("runs the complete foundation verification sequence", () => {
    const workflow = readFileSync(
      new URL("../.github/workflows/ci.yml", import.meta.url),
      "utf8"
    );
    const runCommands = workflow
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*run:\s*(.*?)\s*$/)?.[1])
      .filter((command): command is string => command !== undefined);
    const contentValidationCommands = runCommands.filter((command) =>
      command.startsWith("pnpm validate:content")
    );

    expect(workflow).toContain("actions/checkout@v4");
    expect(workflow).toContain("pnpm/action-setup@v4");
    expect(workflow).toContain('version: "10.34.5"');
    expect(workflow).toContain('node-version: "22"');
    expect(runCommands).toContain("pnpm install --frozen-lockfile");
    expect(runCommands).toContain("pnpm typecheck");
    expect(runCommands).toContain("pnpm lint");
    expect(runCommands).toContain("pnpm test");
    expect(runCommands).toContain("pnpm build:gateway");
    expect(contentValidationCommands).toEqual(["pnpm validate:content:internal"]);
    expect(runCommands).toContain("pnpm --filter @cave/mobile expo:doctor");
    expect(runCommands).toContain("pnpm --filter @cave/mobile export:ios");
    expect(runCommands).toContain("pnpm security:scan-bundle");
    expect(runCommands).toContain("pnpm security:audit");
  });

  it("defines the fixed root verification command", () => {
    expect(contentPackageJson.scripts["validate:content:internal"]).toBe(
      "tsx src/validate-cli.ts --mode internal"
    );
    expect(packageJson.scripts["validate:content:internal"]).toBe(
      "pnpm --filter @cave/content validate:content:internal"
    );
    expect(packageJson.scripts.verify).toContain("pnpm validate:content");
    expect(packageJson.scripts.verify).toBe(
      "pnpm typecheck && pnpm lint && pnpm test && pnpm validate:content && pnpm build:gateway"
    );
  });

  it("keeps local release verification on production", () => {
    expect(packageJson.scripts["verify:release"]).toContain("pnpm verify");
    expect(packageJson.scripts["verify:release"]).toBe(
      "pnpm verify && pnpm --filter @cave/mobile expo:doctor && pnpm --filter @cave/mobile export:ios && pnpm security:scan-bundle && pnpm security:audit"
    );
  });
});

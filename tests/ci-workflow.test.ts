import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import packageJson from "../package.json";

describe("foundation CI workflow", () => {
  it("runs the complete foundation verification sequence", () => {
    const workflow = readFileSync(
      new URL("../.github/workflows/ci.yml", import.meta.url),
      "utf8"
    );

    expect(workflow).toContain("actions/checkout@v4");
    expect(workflow).toContain("pnpm/action-setup@v4");
    expect(workflow).toContain('version: "10.34.5"');
    expect(workflow).toContain('node-version: "22"');
    expect(workflow).toContain("pnpm install --frozen-lockfile");
    expect(workflow).toContain("pnpm typecheck");
    expect(workflow).toContain("pnpm lint");
    expect(workflow).toContain("pnpm test");
    expect(workflow).toContain("pnpm build:gateway");
    expect(workflow).toContain("pnpm validate:content:internal");
    expect(workflow).not.toMatch(/^\s*run: pnpm validate:content\s*$/m);
    expect(workflow).toContain("pnpm --filter @cave/mobile expo:doctor");
    expect(workflow).toContain("pnpm --filter @cave/mobile export:ios");
    expect(workflow).toContain("pnpm security:scan-bundle");
    expect(workflow).toContain("pnpm security:audit");
  });

  it("defines the fixed root verification command", () => {
    expect(packageJson.scripts["validate:content:internal"]).toBe(
      "pnpm --filter @cave/content validate:content:internal"
    );
    expect(packageJson.scripts.verify).toContain("pnpm validate:content");
    expect(packageJson.scripts.verify).toBe(
      "pnpm typecheck && pnpm lint && pnpm test && pnpm validate:content && pnpm build:gateway"
    );
  });

  it("defines one local release verification command matching CI gates", () => {
    expect(packageJson.scripts["verify:release"]).toContain("pnpm verify");
    expect(packageJson.scripts["verify:release"]).toBe(
      "pnpm verify && pnpm --filter @cave/mobile expo:doctor && pnpm --filter @cave/mobile export:ios && pnpm security:scan-bundle && pnpm security:audit"
    );
  });
});

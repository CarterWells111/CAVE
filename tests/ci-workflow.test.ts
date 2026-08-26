import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

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
  });
});

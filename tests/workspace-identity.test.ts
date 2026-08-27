import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));

const expectedPackageNames = new Map([
  ["package.json", "neijie-cave"],
  ["apps/mobile/package.json", "@cave/mobile"],
  ["apps/gateway/package.json", "@cave/gateway"],
  ["packages/contracts/package.json", "@cave/contracts"],
  ["packages/content/package.json", "@cave/content"],
  ["packages/scenario-engine/package.json", "@cave/scenario-engine"],
  ["packages/test-fixtures/package.json", "@cave/test-fixtures"]
]);

function trackedWorkspaceFiles() {
  return execFileSync(
    "git",
    ["ls-files", "package.json", "pnpm-lock.yaml", "apps", "packages"],
    { cwd: workspaceRoot, encoding: "utf8" }
  )
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean);
}

describe("CAVE workspace identity", () => {
  it("uses the approved package names", () => {
    for (const [path, expectedName] of expectedPackageNames) {
      const manifest = JSON.parse(
        readFileSync(resolve(workspaceRoot, path), "utf8")
      ) as { name: string };
      expect(manifest.name).toBe(expectedName);
    }
  });

  it("contains no active legacy package scope", () => {
    for (const path of trackedWorkspaceFiles()) {
      expect(readFileSync(resolve(workspaceRoot, path), "utf8")).not.toContain(
        "@hackathon/"
      );
    }
  });
});

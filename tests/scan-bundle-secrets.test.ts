import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const scanner = fileURLToPath(
  new URL("../scripts/scan-bundle-secrets.mjs", import.meta.url)
);
const temporaryDirectories: string[] = [];

function createFixture(source: string) {
  const directory = mkdtempSync(join(tmpdir(), "cave-bundle-scan-"));
  temporaryDirectories.push(directory);
  writeFileSync(join(directory, "bundle.js"), source, "utf8");
  return directory;
}

function scan(directory: string) {
  return execFileSync(process.execPath, [scanner, directory], {
    encoding: "utf8"
  });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("mobile bundle secret scanner", () => {
  it("fails closed when no exported bundle files are present", () => {
    expect(() => scan(createFixture(""))).not.toThrow();
    const emptyDirectory = mkdtempSync(join(tmpdir(), "cave-bundle-scan-empty-"));
    temporaryDirectories.push(emptyDirectory);

    expect(() => scan(emptyDirectory)).toThrow();
  });

  it("accepts an exported bundle without credential patterns", () => {
    expect(scan(createFixture("globalThis.__CAVE_BUILD__ = 'preview';"))).toContain(
      "bundle secret scan passed"
    );
  });

  it.each([
    ["environment key", "MODEL_API_KEY"],
    ["bearer token", "Bearer sk-test-not-a-real-credential"],
    ["standalone provider key", "const key = 'sk-proj-examplecredential123456';"],
    ["seeded canary", "CAVE_BUNDLE_SECRET_CANARY_7f4b2d"]
  ])("rejects a bundle containing %s", (_label, source) => {
    expect(() => scan(createFixture(source))).toThrow();
  });
});

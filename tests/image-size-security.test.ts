import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const virtualStore = join(import.meta.dirname, "..", "node_modules", ".pnpm");
const packageDirectory = readdirSync(virtualStore).find(
  (name) => name.startsWith("image-size@1.2.1") && name.includes("patch_hash"),
);

if (!packageDirectory) throw new Error("patched image-size@1.2.1 is not installed");

const imageSizeEntry = join(
  virtualStore,
  packageDirectory,
  "node_modules",
  "image-size",
  "dist",
  "index.js",
);

function parseInChildProcess(bytes: number[]) {
  const program = [
    `const imageSize = require(${JSON.stringify(imageSizeEntry)});`,
    "try { imageSize(Uint8Array.from(JSON.parse(process.argv[1]))); } catch {}",
  ].join("\n");

  return () => execFileSync(process.execPath, ["-e", program, JSON.stringify(bytes)], {
    stdio: "pipe",
    timeout: 1_000,
  });
}

describe("patched image-size parsers", () => {
  it("terminates on zero-sized JXL boxes", () => {
    expect(parseInChildProcess([0, 0, 0, 0, 0x4a, 0x58, 0x4c, 0x20])).not.toThrow();
  });

  it("terminates on zero-length ICNS entries", () => {
    expect(parseInChildProcess([
      0x69, 0x63, 0x6e, 0x73,
      0, 0, 0, 16,
      0x69, 0x63, 0x30, 0x37,
      0, 0, 0, 0,
    ])).not.toThrow();
  });
});

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

const mobileRequire = createRequire(new URL("../apps/mobile/package.json", import.meta.url));
const routerRequire = createRequire(mobileRequire.resolve("expo-router/package.json"));
const queryStringRequire = createRequire(routerRequire.resolve("query-string/package.json"));
const expoRequire = createRequire(mobileRequire.resolve("expo/package.json"));
const configPluginsRequire = createRequire(expoRequire.resolve("@expo/config-plugins/package.json"));
const xcodeRequire = createRequire(configPluginsRequire.resolve("xcode/package.json"));

describe("audited transitive dependency compatibility", () => {
  it("uses the bounded malformed-URI decoder required by Expo Router", () => {
    const entry = queryStringRequire.resolve("decode-uri-component");
    const manifest = JSON.parse(readFileSync(join(dirname(entry), "package.json"), "utf8")) as {
      version: string;
    };
    const queryStringEntry = routerRequire.resolve("query-string");
    const malformedInput = "%80".repeat(2_000);

    expect(manifest.version).toBe("0.5.0");
    expect(() => execFileSync(process.execPath, [
      "-e",
      `require(${JSON.stringify(queryStringEntry)}).parse(${JSON.stringify(`value=${malformedInput}`)})`,
    ], { timeout: 1_000 })).not.toThrow();
  });

  it("keeps xcode's CommonJS uuid.v4 integration working", () => {
    const manifest = xcodeRequire("uuid/package.json") as { version: string };
    const xcode = configPluginsRequire("xcode") as {
      project(path: string): {
        generateUuid(): string;
        hash: { project: { objects: Record<string, unknown> } };
      };
    };
    const project = xcode.project("unused.pbxproj");
    project.hash = { project: { objects: {} } };

    expect(manifest.version).toBe("11.1.1");
    expect(project.generateUuid()).toMatch(/^[A-F0-9]{24}$/u);
  });
});

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const scanner = fileURLToPath(
  new URL("../scripts/verify-mobile-source-policy.mjs", import.meta.url)
);
const mobileSourceRoots = [
  fileURLToPath(new URL("../apps/mobile/src/", import.meta.url)),
  fileURLToPath(new URL("../apps/mobile/app/", import.meta.url))
];
const productionExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const imageSaveAdapterPath = "features/journey/infrastructure/expo-card-image-adapter.ts";
const actualImageSaveAdapter = readFileSync(
  new URL(
    "../apps/mobile/src/features/journey/infrastructure/expo-card-image-adapter.ts",
    import.meta.url
  ),
  "utf8"
);
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
) as { scripts?: Record<string, string> };
const temporaryDirectories: string[] = [];

function enumerateProductionFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "test" ? [] : enumerateProductionFiles(file);
    }
    return entry.isFile()
      && productionExtensions.has(extname(entry.name))
      && !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(entry.name)
      ? [file]
      : [];
  });
}

function createFixture(files: Record<string, string>) {
  const directory = mkdtempSync(join(tmpdir(), "cave-mobile-policy-"));
  temporaryDirectories.push(directory);

  for (const [relativePath, source] of Object.entries(files)) {
    const file = join(directory, relativePath);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, source, "utf8");
  }

  return directory;
}

function createEmptyFixture() {
  const directory = mkdtempSync(join(tmpdir(), "cave-mobile-policy-empty-"));
  temporaryDirectories.push(directory);
  return directory;
}

function scanTargets(targets: string[]) {
  return spawnSync(process.execPath, [scanner, ...targets], { encoding: "utf8" });
}

function scan(files: Record<string, string>) {
  return scanTargets([createFixture(files)]);
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("mobile Demo source policy", () => {
  it("exposes the deterministic repository scan as a root script", () => {
    expect(packageJson.scripts?.["verify:mobile-policy"]).toBe(
      "node scripts/verify-mobile-source-policy.mjs"
    );
  });

  it("scans every independently enumerated production file under src and Expo Router app by default", () => {
    const filesByRoot = mobileSourceRoots.map(enumerateProductionFiles);
    expect(filesByRoot.every((files) => files.length > 0)).toBe(true);
    const expectedCount = new Set(filesByRoot.flat()).size;

    const result = spawnSync(process.execPath, [scanner], { encoding: "utf8" });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`mobile source policy passed (${expectedCount} files)`);
  });

  it.each([
    [
      "AI provider integration",
      "screen.ts",
      'import { generateText } from "ai";\nvoid generateText({ prompt: "private" });',
      "AI/model/Gateway integration"
    ],
    [
      "model client integration",
      "screen.tsx",
      'import OpenAI from "openai";\nconst client = new OpenAI();',
      "AI/model/Gateway integration"
    ],
    [
      "local model consumer integration",
      "screen.ts",
      'import { invoke } from "./model-client";\nvoid invoke();',
      "AI/model/Gateway integration"
    ],
    [
      "Gateway consumption",
      "gateway-consumer.ts",
      'import { turnGateway } from "@cave/gateway";\nvoid turnGateway.generate();',
      "AI/model/Gateway integration"
    ],
    [
      "recording APIs",
      "recorder.ts",
      'import { Audio } from "expo-av";\nvoid Audio.Recording.createAsync();',
      "recording path"
    ],
    [
      "automatic permission requests",
      "screen.tsx",
      "void MediaLibrary.requestPermissionsAsync();",
      "automatic permission request"
    ],
    [
      "sensitive request logging",
      "screen.ts",
      'console.log("request body", request.body);',
      "sensitive message/body logging"
    ],
    [
      "readiness scoring",
      "readiness.ts",
      "const readinessScore = completedItems / totalItems;",
      "readiness-score implementation"
    ]
  ])("rejects %s and reports its path", (_name, path, source, label) => {
    const result = scan({ [path]: source });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(label);
    expect(result.stderr).toContain(path);
  });

  it.each([
    [
      "template-expression provider fetch",
      'void fetch(`https://api.openai.com/${route}`);',
      "AI/model/Gateway integration"
    ],
    [
      "computed recording invocation",
      'void recorder["startRecordingAsync"]();',
      "recording path"
    ],
    [
      "computed readiness assignment",
      'metrics["readinessScore"] = value;',
      "readiness-score implementation"
    ]
  ])("rejects executable %s", (_name, source, label) => {
    const result = scan({ "computed-policy.ts": source });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(label);
  });

  it.each([
    [
      "indirect local endpoint fetch",
      "const endpoint = '/gateway/turn'; fetch(endpoint);",
      "AI/model/Gateway integration"
    ],
    [
      "aliased fetch reference",
      "const send = fetch; send(endpoint);",
      "AI/model/Gateway integration"
    ],
    [
      "aliased permission request",
      "const ask = MediaLibrary.requestPermissionsAsync; ask();",
      "automatic permission request"
    ],
    [
      "destructured permission request",
      "const { requestPermissionsAsync: ask } = MediaLibrary; ask();",
      "automatic permission request"
    ],
    [
      "computed permission request alias",
      'const ask = MediaLibrary["requestPermissionsAsync"]; ask();',
      "automatic permission request"
    ],
    [
      "aliased private message log",
      "const privateMessage = message; console.log(privateMessage);",
      "sensitive message/body logging"
    ],
    [
      "direct log call with dynamic data",
      "log(privateMessage);",
      "sensitive message/body logging"
    ],
    [
      "bare readiness implementation",
      "const readiness = completed / total;",
      "readiness-score implementation"
    ]
  ])("rejects fail-closed %s", (_name, source, label) => {
    const result = scan({ "fail-closed-policy.ts": source });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(label);
  });

  it.each([
    ["template substitution", "console.log(`request: ${request.body}`);"],
    ["computed property", 'console.info(request["body"]);'],
    ["nested call", "console.warn(redact(request.body));"],
    ["named logger", "privacyLogger.debug(message);"]
  ])("rejects sensitive logging through %s", (_name, source) => {
    const result = scan({ "logger.ts": source });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("sensitive message/body logging");
    expect(result.stderr).toContain("logger.ts");
  });

  it("ignores sensitive-looking text in comments and string literals", () => {
    const result = scan({
      "safe-copy.ts": [
        '// console.log(request.body);',
        'const example = "privacyLogger.debug(message)";',
        'console.info("request.body is never logged");'
      ].join("\n")
    });

    expect(result.status).toBe(0);
  });

  it.each([
    [
      "AI/model/Gateway integration",
      [
        "// aiClient.generate();",
        'const example = "gatewayService.send()";'
      ].join("\n")
    ],
    [
      "recording path",
      [
        "// void Audio.Recording.createAsync();",
        'const example = "Recording.createAsync";'
      ].join("\n")
    ],
    [
      "permission request",
      [
        "// void MediaLibrary.requestPermissionsAsync();",
        'const example = "requestCameraPermissionsAsync()";'
      ].join("\n")
    ],
    [
      "sensitive logging",
      [
        "// console.log(request.body);",
        'const example = "privacyLogger.debug(message)";',
        'console.info("request.body is never logged");'
      ].join("\n")
    ],
    [
      "readiness score",
      [
        "// const readinessScore = 1;",
        'const example = "calculateReadiness";'
      ].join("\n")
    ]
  ])("ignores harmless comments and string literals for %s", (_category, source) => {
    const result = scan({ "safe-syntax.ts": source });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("accepts the scanner implementation as syntax rather than policy behavior", () => {
    const result = scanTargets([scanner]);

    expect(result.status).toBe(0);
  });

  it.each(["missing", "unreadable", "unsupported", "unexpected-empty"])(
    "fails closed for each %s explicit target even when another target is valid",
    (kind) => {
      const valid = createFixture({ "valid.ts": "export const safe = true;" });
      let target: string;

      if (kind === "missing") {
        target = join(valid, "missing-target");
      } else if (kind === "unreadable") {
        const directory = createEmptyFixture();
        target = join(directory, "invalid-utf8.ts");
        writeFileSync(target, Buffer.from([0xff, 0xfe, 0xfd]));
      } else if (kind === "unsupported") {
        const directory = createEmptyFixture();
        target = join(directory, "notes.txt");
        writeFileSync(target, "not mobile source", "utf8");
      } else {
        target = createEmptyFixture();
      }

      const result = scanTargets([valid, target]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`target failed: ${kind}`);
      expect(result.stderr).toContain(basename(target));
    }
  );

  it("reports a stable non-empty path when the explicit target is a file", () => {
    const directory = createFixture({ "screen.ts": "const readinessScore = 1;" });
    const file = join(directory, "screen.ts");
    const result = scanTargets([file]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("screen.ts:1");
    expect(result.stderr).not.toContain(" in :1");
  });

  it("deduplicates files reached through overlapping explicit targets", () => {
    const directory = createFixture({ "screen.ts": "const readinessScore = 1;" });
    const result = scanTargets([directory, join(directory, "screen.ts")]);

    expect(result.status).toBe(1);
    expect(result.stderr.match(/readiness-score implementation/gu)).toHaveLength(1);
  });

  it("reports overlapping explicit targets identically regardless of target order", () => {
    const directory = createFixture({
      "features/screen.ts": "const readinessScore = 1;"
    });
    const file = join(directory, "features/screen.ts");

    const directoryFirst = scanTargets([directory, file]);
    const fileFirst = scanTargets([file, directory]);

    expect(directoryFirst.status).toBe(1);
    expect(fileFirst.status).toBe(1);
    expect(directoryFirst.stderr).toBe(fileFirst.stderr);
  });

  it.each([
    ["camera", "void Camera.requestCameraPermissionsAsync();"],
    ["microphone", "void Audio.requestMicrophonePermissionsAsync();"],
    ["generic", "void Permissions.requestPermissionsAsync();"]
  ])("rejects %s permission requests inside the image-save adapter", (_name, request) => {
    const result = scan({
      [imageSaveAdapterPath]: [
        "export async function saveCardImageToLibrary() {",
        `  ${request}`,
        "}"
      ].join("\n")
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("automatic permission request");
    expect(result.stderr).toContain(imageSaveAdapterPath);
  });

  it("rejects a module-scope photo permission request inside the image-save adapter", () => {
    const result = scan({
      [imageSaveAdapterPath]:
        "void MediaLibrary.requestPermissionsAsync(true, ['photo']);"
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("automatic permission request");
    expect(result.stderr).toContain(imageSaveAdapterPath);
  });

  it("accepts the actual explicit photo permission request inside the user-triggered save operation", () => {
    const result = scan({ [imageSaveAdapterPath]: actualImageSaveAdapter });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("mobile source policy passed (1 files)");
  });

  it("accepts user-visible no-AI copy and unrelated local implementation terms", () => {
    const result = scan({
      "features/journey/ui/PresetPracticePage.tsx": [
        'const notice = "预设对话，不使用 AI";',
        "const zoomPercent = Math.round(zoom * 100);",
        "type Labels = Record<string, string>;",
        'console.error("local image save failed");',
        "console.log(`static local status`);"
      ].join("\n")
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("mobile source policy passed (1 files)");
  });
});

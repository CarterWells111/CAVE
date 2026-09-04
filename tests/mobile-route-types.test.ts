import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";
import { generateRoutes } from "../scripts/generate-mobile-routes.mjs";

const temporary: string[] = [];
const mobileRoot = resolve(import.meta.dirname, "../apps/mobile");
afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "cave-route-types-"));
  temporary.push(root);
  const appRoot = join(root, "app");
  const outputDir = join(root, "types");
  mkdirSync(join(appRoot, "(tabs)"), { recursive: true });
  writeFileSync(join(appRoot, "(tabs)", "index.tsx"), "export default function Page() { return null; }");
  writeFileSync(join(appRoot, "(tabs)", "journal.tsx"), "export default function Page() { return null; }");
  return { appRoot, outputDir, root };
}

describe("mobile route type generation", () => {
  it.each(["missing", "stale", "current"])("rebuilds %s declarations from the route files", (state) => {
    const args = fixture();
    if (state !== "missing") {
      mkdirSync(args.outputDir, { recursive: true });
      writeFileSync(join(args.outputDir, "router.d.ts"), "// obsolete routes");
    }
    generateRoutes(args);
    const declaration = readFileSync(join(args.outputDir, "router.d.ts"), "utf8");
    expect(declaration).toContain("/journal");
    expect(declaration).toContain("/(tabs)");
    if (state === "current") {
      generateRoutes(args);
      expect(readFileSync(join(args.outputDir, "router.d.ts"), "utf8")).toBe(declaration);
    }
  });

  it("uses generated Href types to accept real routes and reject an invented destination", () => {
    const args = fixture();
    generateRoutes(args);
    const source = join(args.root, "consumer.ts");
    writeFileSync(source, 'import type { Href } from "expo-router";\nconst valid: Href = "/(tabs)/journal";\nconst invalid: Href = "/route-that-does-not-exist";\n');
    const program = ts.createProgram([source, join(args.outputDir, "router.d.ts")], {
      noEmit: true, strict: true, skipLibCheck: true, types: [],
      module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
      paths: { "expo-router": [join(mobileRoot, "node_modules/expo-router")] },
    });
    const errors = ts.getPreEmitDiagnostics(program).filter((error) => error.file && resolve(error.file.fileName) === resolve(source));
    expect(errors.map((error) => error.code)).toEqual([2322]);
    expect(ts.flattenDiagnosticMessageText(errors[0]!.messageText, " ")).toContain("route-that-does-not-exist");
  });

  it("fails explicitly when the route directory does not exist", () => {
    const args = fixture();
    expect(() => generateRoutes({ ...args, appRoot: join(args.root, "missing") })).toThrow();
  });

  it("rejects malformed route trees without replacing a usable cache", () => {
    const args = fixture();
    generateRoutes(args);
    const before = readFileSync(join(args.outputDir, "router.d.ts"), "utf8");
    writeFileSync(join(args.appRoot, "+bogus.tsx"), "export default function Page() { return null; }");
    expect(() => generateRoutes(args)).toThrow();
    expect(readFileSync(join(args.outputDir, "router.d.ts"), "utf8")).toBe(before);
  });
});

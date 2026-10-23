import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const mobileRequire = createRequire(new URL("../apps/mobile/package.json", import.meta.url));
const expoRequire = createRequire(mobileRequire.resolve("expo/package.json"));
const cliManifest = expoRequire.resolve("@expo/cli/package.json");
const cliRequire = createRequire(cliManifest);
const cliRoot = dirname(cliManifest);
type ParseResult<Value = unknown> = { success: true; data: Value } | {
  success: false; error: { message: string; issues: { code: string; message: string }[] };
};
type Schema<Value = unknown> = {
  parse(value: unknown): Value;
  safeParse(value: unknown): ParseResult<Value>;
  safeParseAsync(value: unknown): Promise<ParseResult<Value>>;
};
type ElementSchema = Schema & { superRefine(callback: () => void | Promise<void>): ElementSchema };
type BoundedSchema = Schema & { max(size: number): BoundedSchema };
type ArraySchema = BoundedSchema & { length(size: number): BoundedSchema };
type ZodApi = {
  unknown(): ElementSchema; string(): ElementSchema;
  array(element: ElementSchema): ArraySchema; set(element: ElementSchema): BoundedSchema;
  toJSONSchema(schema: Schema): unknown;
};
const z = mobileRequire("zod").z as ZodApi;

type Plugin = {
  packageName: string; packageRoot: string; cliExtensions: {
    description: string; entryPoint: string;
    commands: { name: string; title: string; environments: string[]; parameters?: { name: string; type: string }[] }[];
  };
};
const plugin = (): Plugin => ({
  packageName: "synthetic-plugin", packageRoot: "synthetic-root",
  cliExtensions: { description: "Synthetic commands", entryPoint: "index.js", commands: [
    { name: "inspect", title: "Inspect", environments: ["cli", "mcp"], parameters: [
      { name: "text", type: "text" }, { name: "count", type: "number" }, { name: "confirmed", type: "confirm" },
    ] },
  ] },
});
const schemas = cliRequire(join(cliRoot, "build/src/start/server/DevToolsPlugin.schema.js")) as {
  PluginSchema: Schema<Plugin>;
  DevToolsPluginOutputSchema: Schema;
};
const { createMCPDevToolsExtensionSchema } = cliRequire(join(cliRoot, "build/src/start/server/createMCPDevToolsExtensionSchema.js")) as {
  createMCPDevToolsExtensionSchema(value: Plugin): Schema;
};

describe("patched Zod dependency and Expo CLI compatibility", () => {
  it("uses the published patch for every current consumer without a global Zod3 override or new audit ignore", () => {
    const astroRequire = createRequire(createRequire(new URL("../apps/web/package.json", import.meta.url)).resolve("astro/package.json"));
    for (const consumer of [
      mobileRequire, cliRequire, astroRequire,
      createRequire(new URL("../apps/gateway/package.json", import.meta.url)),
      createRequire(new URL("../packages/contracts/package.json", import.meta.url)),
      createRequire(new URL("../packages/content/package.json", import.meta.url)),
    ]) expect(consumer("zod/package.json").version).toBe("4.6.6");
    expect(cliRequire("./package.json").version).toBe("57.0.32");
    const workspace = parse(readFileSync(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8")) as {
      overrides: Record<string, string>; auditConfig: { ignoreGhsas: string[] };
    };
    expect(workspace.overrides["zod@>=4 <4.6.6"]).toBe("4.6.6");
    expect(workspace.overrides["@expo/cli@57.0.32>zod"]).toBe("4.6.6");
    expect(workspace.overrides.zod).toBeUndefined();
    expect(workspace.auditConfig.ignoreGhsas).not.toContain("GHSA-mrhx-c7xc-m3w5");
  });

  it("preserves actual CLI plugin validation, readonly environments and downstream error messages", () => {
    const valid = plugin();
    expect(schemas.PluginSchema.parse(valid)).toEqual(valid);
    expect(Object.isFrozen(schemas.PluginSchema.parse(valid).cliExtensions.commands[0]!.environments)).toBe(true);
    for (const invalid of [
      { ...valid, packageName: "" },
      { ...valid, cliExtensions: { ...valid.cliExtensions, commands: [] } },
      { ...valid, cliExtensions: { ...valid.cliExtensions, commands: [{ name: "inspect", title: "Inspect", environments: ["unknown"] }] } },
    ]) {
      const result = schemas.PluginSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).not.toBe("");
        expect(result.error.issues.map(issue => issue.message).join(", ")).not.toBe("");
      }
    }
  });

  it("preserves actual CLI text/image/audio output validation and rejects invalid output", () => {
    const valid = [
      { type: "text", text: "Synthetic result", level: "info" },
      { type: "image", url: "https://example.invalid/image" },
      { type: "audio", url: "https://example.invalid/audio" },
    ];
    expect(schemas.DevToolsPluginOutputSchema.parse(valid)).toEqual(valid);
    for (const invalid of [
      [{ type: "image", url: "not-a-url" }],
      [{ type: "text", text: "Synthetic result", level: "unknown" }],
      [{ type: "video", url: "https://example.invalid/video" }],
    ]) {
      const result = schemas.DevToolsPluginOutputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues.map(issue => issue.message).join(", ")).not.toBe("");
    }
  });

  it("preserves the CLI's strict MCP command schema, typed optional arguments and JSON schema export", () => {
    const input = createMCPDevToolsExtensionSchema(plugin());
    expect(input.safeParse({ command: "inspect", text: "ok", count: 1, confirmed: true }).success).toBe(true);
    expect(input.safeParse({ command: "inspect" }).success).toBe(true);
    for (const invalid of [{ command: "unknown" }, { command: "inspect", count: "bad" }, { command: "inspect", extra: true }]) {
      expect(input.safeParse(invalid).success).toBe(false);
    }
    expect(z.toJSONSchema(input)).toMatchObject({ additionalProperties: false, required: ["command"] });
    expect(() => createMCPDevToolsExtensionSchema({ ...plugin(), cliExtensions: { ...plugin().cliExtensions, commands: [] } }))
      .toThrow("no commands defined");
  });
});

describe("oversized bounded collections reject before visiting elements", () => {
  it.each(["max", "length"] as const)("short-circuits a leading array %s bound synchronously", bound => {
    let visits = 0;
    const element = z.unknown().superRefine(() => { visits += 1; });
    const schema = bound === "max" ? z.array(element).max(1) : z.array(element).length(1);
    const result = schema.safeParse([1, 2, 3]);
    expect(result.success).toBe(false);
    expect(visits).toBe(0);
    if (!result.success) expect(result.error.issues[0]?.code).toBe("too_big");
    expect(schema.safeParse([1]).success).toBe(true);
    expect(visits).toBe(1);
  });

  it("rejects an oversized bounded array before scheduling asynchronous element validation", async () => {
    let visits = 0;
    const schema = z.array(z.unknown().superRefine(async () => { visits += 1; })).max(1);
    expect((await schema.safeParseAsync([1, 2, 3])).success).toBe(false);
    expect(visits).toBe(0);
    expect((await schema.safeParseAsync([1])).success).toBe(true);
    expect(visits).toBe(1);
  });

  it("rejects an oversized bounded set before validating its members", () => {
    let visits = 0;
    const schema = z.set(z.string().superRefine(() => { visits += 1; })).max(1);
    expect(schema.safeParse(new Set(["first", "second"])).success).toBe(false);
    expect(visits).toBe(0);
    expect(schema.safeParse(new Set(["first"])).success).toBe(true);
    expect(visits).toBe(1);
  });
});

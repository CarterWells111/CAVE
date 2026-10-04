import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// Resolve the actual Metro and Astro leaves, including pnpm's installed patches.
const mobileRequire = createRequire(new URL("../apps/mobile/package.json", import.meta.url));
const expoRequire = createRequire(mobileRequire.resolve("expo/package.json"));
const cliRequire = createRequire(expoRequire.resolve("@expo/cli/package.json"));
const metroRequire = createRequire(cliRequire.resolve("@expo/metro/package.json"));
const mapRequire = createRequire(metroRequire.resolve("metro-file-map/package.json"));
const micromatchRequire = createRequire(mapRequire.resolve("micromatch/package.json"));
const webRequire = createRequire(new URL("../apps/web/package.json", import.meta.url));
const astroRequire = createRequire(webRequire.resolve("astro/package.json"));

type Node = { type: string; nodes?: Node[]; value?: string; parent?: Node };
type BraceApi = {
  parse(input: string): Node;
  compile(input: string | Node): string;
  expand(input: string | Node): string[];
  stringify(input: string | Node): string;
};
const braces = micromatchRequire("braces") as BraceApi;

function deepAst() {
  const ast: Node = { type: "root", nodes: [] };
  let parent = ast;
  for (let i = 0; i < 4_500; i++) {
    const child: Node = { type: "paren", nodes: [], parent };
    parent.nodes!.push(child);
    parent = child;
  }
  parent.nodes!.push({ type: "text", value: "x", parent });
  return ast;
}

describe("braces nesting denial-of-service mitigation", () => {
  it.each(["parse", "compile", "expand", "stringify"] as const)("bounds deeply nested strings in %s", (operation) => {
    for (const [open, close] of [["{", "}"], ["(", ")"], ["{(", ")}"]]) {
      const input = open.repeat(2_250) + "a,b" + close.repeat(2_250);
      expect(input.length).toBeLessThan(10_000);
      expect(() => braces[operation](input)).toThrow(SyntaxError);
      expect(() => braces[operation](input)).toThrow("braces nesting depth exceeds 128");
    }
    expect(() => braces[operation]("{".repeat(4_500))).toThrow("braces nesting depth exceeds 128");
  });

  it.each(["compile", "expand", "stringify"] as const)("bounds caller-supplied ASTs in %s", (operation) => {
    expect(() => braces[operation](deepAst())).toThrow(SyntaxError);
    expect(() => braces[operation](deepAst())).toThrow("braces nesting depth exceeds 128");
  });

  it("accepts the depth boundary and preserves normal Metro glob behavior", () => {
    const boundary = "(".repeat(128) + "x" + ")".repeat(128);
    expect(braces.stringify(boundary)).toBe(boundary);
    expect(braces.compile(boundary)).toBe(boundary);
    expect(braces.expand(boundary)).toEqual([boundary]);
    expect(() => braces.parse("(".repeat(129) + "x" + ")".repeat(129))).toThrow(SyntaxError);
    expect(braces.expand("src/{app,lib}/file{1..3}.ts")).toEqual([
      "src/app/file1.ts", "src/app/file2.ts", "src/app/file3.ts",
      "src/lib/file1.ts", "src/lib/file2.ts", "src/lib/file3.ts",
    ]);
    const expression = new RegExp("^" + braces.compile("src/{app,lib}/file{1..3}.ts") + "$");
    expect(expression.test("src/app/file2.ts")).toBe(true);
    expect(expression.test("src/other/file2.ts")).toBe(false);
    expect(braces.stringify("literal\\{braces\\}")).toBe("literal{braces}");
    const micromatch = mapRequire("micromatch") as (paths: string[], pattern: string) => string[];
    expect(micromatch(["app/a.ts", "app/a.js", "lib/b.ts"], "{app,lib}/*.ts")).toEqual(["app/a.ts", "lib/b.ts"]);
  });
});

type Request = { url: string; headers: Record<string, string> };
const CachePolicy = astroRequire("http-cache-semantics") as new (
  request: Request,
  response: { status: number; headers: Record<string, string> },
  options: { shared: boolean },
) => { now(): number; satisfiesWithoutRevalidation(request: Request): boolean };

describe("shared HTTP cache security", () => {
  it.each([
    { "cache-control": "max-age=0", "set-cookie": "synthetic=value" },
    { "cache-control": "max-age=0, proxy-revalidate" },
    { "cache-control": "no-cache, stale-while-revalidate=300" },
    { "cache-control": "no-store" },
    { "cache-control": "private, max-age=60" },
  ])("requires revalidation despite max-stale for %j", (headers) => {
    const request = { url: "https://example.invalid/resource", headers: { host: "example.invalid" } };
    const policy = new CachePolicy(request, { status: 200, headers }, { shared: true });
    policy.now = () => Date.now() + 60_000;
    expect(policy.satisfiesWithoutRevalidation({ ...request, headers: { ...request.headers, "cache-control": "max-stale" } })).toBe(false);
  });

  it("preserves ordinary public caching", () => {
    const request = { url: "https://example.invalid/resource", headers: { host: "example.invalid" } };
    const policy = new CachePolicy(request, { status: 200, headers: { "cache-control": "public, max-age=60" } }, { shared: true });
    expect(policy.satisfiesWithoutRevalidation(request)).toBe(true);
    policy.now = () => Date.now() + 90_000;
    expect(policy.satisfiesWithoutRevalidation({ ...request, headers: { ...request.headers, "cache-control": "max-stale" } })).toBe(true);
  });
});

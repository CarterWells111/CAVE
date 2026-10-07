import { readFileSync } from "node:fs";
import { createServer, get, type IncomingMessage, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

// Follow the consumers' resolution paths rather than a stale virtual-store entry.
const mobileRequire = createRequire(new URL("../apps/mobile/package.json", import.meta.url));
const expoRequire = createRequire(mobileRequire.resolve("expo/package.json"));
const cliManifest = expoRequire.resolve("@expo/cli/package.json");
const cliRequire = createRequire(cliManifest);
const metroConfigRequire = createRequire(expoRequire.resolve("@expo/metro-config/package.json"));
const postcssRequire = createRequire(metroConfigRequire.resolve("postcss/package.json"));
const nativeRequire = createRequire(mobileRequire.resolve("react-native/package.json"));
const devtoolsRequire = createRequire(nativeRequire.resolve("react-devtools-core/package.json"));
const webRequire = createRequire(new URL("../apps/web/package.json", import.meta.url));
const astroManifest = webRequire.resolve("astro/package.json");
const astroRequire = createRequire(astroManifest);
const gatewayRequire = createRequire(new URL("../apps/gateway/package.json", import.meta.url));
const wranglerRequire = createRequire(gatewayRequire.resolve("wrangler/package.json"));
const miniflareRequire = createRequire(wranglerRequire.resolve("miniflare/package.json"));

function sharpVersion(consumer: ReturnType<typeof createRequire>) {
  return JSON.parse(readFileSync(join(dirname(consumer.resolve("sharp")), "..", "package.json"), "utf8")).version;
}

describe("production advisory fixes preserve consumer compatibility", () => {
  it("keeps React DevTools editor argument parsing and ordinary shell quoting working", () => {
    expect(devtoolsRequire("shell-quote/package.json").version).toBe("1.11.0");
    const shellQuote = devtoolsRequire("shell-quote") as {
      parse(input: string): string[];
      quote(tokens: string[]): string;
    };
    const tokens = ["code", "--goto", "synthetic folder/file.ts:3:2"];

    expect(shellQuote.parse("code --goto 'synthetic folder/file.ts:3:2'")).toEqual(tokens);
    expect(shellQuote.parse(shellQuote.quote(tokens))).toEqual(tokens);
  });

  it("preserves PostCSS source maps and normal indexed mappings", () => {
    expect(postcssRequire("source-map-js/package.json").version).toBe("1.2.2");
    const postcss = metroConfigRequire("postcss") as (plugins: unknown[]) => {
      process(css: string, options: unknown): { css: string; map: { toJSON(): unknown } };
    };
    type Position = { line: number; column: number; source: string; name: string | null };
    const { SourceMapConsumer, SourceMapGenerator } = postcssRequire("source-map-js") as {
      SourceMapConsumer: new (map: unknown) => { originalPositionFor(position: { line: number; column: number }): Position };
      SourceMapGenerator: new (options: { file: string }) => {
        addMapping(mapping: { generated: { line: number; column: number }; original: { line: number; column: number }; source: string }): void;
        toJSON(): unknown;
      };
    };
    const result = postcss([]).process("a { color: red; }", {
      from: "synthetic.css",
      to: "synthetic.out.css",
      map: { inline: false, annotation: false },
    });
    expect(result.css).toBe("a { color: red; }");
    expect(new SourceMapConsumer(result.map.toJSON()).originalPositionFor({ line: 1, column: 0 })).toMatchObject({
      source: "synthetic.css", line: 1, column: 0,
    });

    const map = new SourceMapGenerator({ file: "synthetic.out.css" });
    map.addMapping({ generated: { line: 1, column: 0 }, original: { line: 2, column: 3 }, source: "synthetic.css" });
    const indexed = new SourceMapConsumer({ version: 3, sections: [{ offset: { line: 1, column: 2 }, map: map.toJSON() }] });
    expect(indexed.originalPositionFor({ line: 2, column: 3 })).toEqual({
      source: "synthetic.css", line: 2, column: 3, name: null,
    });
  });

  it("preserves Expo's bundle compression and ordinary-path bypass", async () => {
    expect(cliRequire("compression/package.json").version).toBe("1.8.2");
    const { compression } = cliRequire(join(dirname(cliManifest), "build/src/start/server/metro/dev-server/compression.js")) as {
      compression(request: IncomingMessage, response: ServerResponse, next: () => void): void;
    };
    const body = "synthetic bundle text;".repeat(128);
    const server = createServer((request, response) => compression(request, response, () => {
      response.setHeader("Content-Type", "application/javascript");
      response.end(body);
    }));

    try {
      await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected local TCP server");
      const request = (path: string) => new Promise<{ headers: IncomingMessage["headers"]; data: Buffer }>((done, fail) => {
        const client = get({ hostname: "127.0.0.1", port: address.port, path, headers: { "Accept-Encoding": "gzip" } }, (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.once("error", fail);
          response.once("end", () => done({ headers: response.headers, data: Buffer.concat(chunks) }));
        });
        client.once("error", fail);
      });

      for (const path of ["/synthetic.bundle", "/synthetic.map"]) {
        const compressed = await request(path);
        expect(compressed.headers["content-encoding"]).toBe("gzip");
        expect(compressed.headers.vary).toContain("Accept-Encoding");
        expect(gunzipSync(compressed.data).toString()).toBe(body);
      }
      const ordinary = await request("/synthetic.txt");
      expect(ordinary.headers["content-encoding"]).toBeUndefined();
      expect(ordinary.data.toString()).toBe(body);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((done, fail) => server.close((error) => error ? fail(error) : done()));
    }
  });

  it("uses fixed Sharp in Astro and Miniflare and transforms a synthetic image through Astro", async () => {
    expect(sharpVersion(astroRequire)).toBe("0.35.5");
    expect(sharpVersion(miniflareRequire)).toBe("0.35.5");
    type Sharp = {
      (input: unknown): {
        png(): { toBuffer(): Promise<Buffer> };
        metadata(): Promise<{ width: number; height: number; format: string }>;
      };
      versions: { rsvg: string };
    };
    const sharp = astroRequire("sharp") as Sharp;
    expect(sharp.versions.rsvg).toBe("2.63.2");
    const input = await sharp({ create: { width: 4, height: 4, channels: 4, background: "#123456" } }).png().toBuffer();
    const { default: service } = await import(pathToFileURL(join(dirname(astroManifest), "dist/assets/services/sharp.js")).href) as {
      default: {
        transform(input: Buffer, options: unknown, config: unknown): Promise<{ data: Uint8Array; format: string }>;
      };
    };
    const output = await service.transform(input, { src: "synthetic.png", width: 2, height: 2, format: "webp" }, {
      service: { config: {} },
    });

    expect(output.format).toBe("webp");
    expect(await sharp(output.data).metadata()).toMatchObject({ width: 2, height: 2, format: "webp" });
  });
});

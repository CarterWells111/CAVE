import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const activeLines = (source: string) =>
  source
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

const expectedHeaders = [
  "Content-Security-Policy: default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self'; form-action 'none'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'none'; style-src 'self'; upgrade-insecure-requests",
  "Referrer-Policy: strict-origin-when-cross-origin",
  "X-Content-Type-Options: nosniff",
  "X-Frame-Options: DENY",
  "Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=(), usb=()"
] as const;

const expectedSitemapLocations = [
  "https://neijiecave.com/",
  "https://neijiecave.com/demo/",
  "https://neijiecave.com/privacy/",
  "https://neijiecave.com/support/",
  "https://neijiecave.com/safety/",
  "https://neijiecave.com/sources/"
] as const;

const approvedFaviconSha256 =
  "445618AEB1A01E7B091AE47F041932C9EDDF0835FFA4678974EA1E621442B0D8";
const approvedBrandLogoSha256 =
  "EB46D26357D1FBA99AB723C80D1510E31F29B0C4BC1B3FFE96E1B9CCB594F2BD";
const approvedDemoVideoSha256 =
  "1E671BE1A722B4AEE7BF5443777EA7D0A9B51C298D34A7933F8A30C9D2603C10";
const approvedDemoPosterSha256 =
  "8693B62021BC0ACA4065BE569DA880101F9DD2460B93533E79DD587E48DF99DC";

const sha256 = (source: Buffer) =>
  createHash("sha256").update(source).digest("hex").toUpperCase();

const assertHeadersControls = (source: string) => {
  const normalized = source.replace(/\r\n?/gu, "\n");
  expect(normalized.endsWith("\n")).toBe(true);

  const lines = normalized.slice(0, -1).split("\n");
  expect(lines).toHaveLength(expectedHeaders.length + 1);
  expect(lines[0]).toBe("/*");

  for (const [index, expectedHeader] of expectedHeaders.entries()) {
    const line = lines[index + 1];
    expect(line).toMatch(/^ {2,}\S/u);
    expect(line?.trim()).toBe(expectedHeader);
  }
};

const assertSitemapControls = (source: string) => {
  const urlOpenings = source.match(/<url\b[^>]*>/giu) ?? [];
  const urlClosings = source.match(/<\/url\s*>/giu) ?? [];
  const urlBlocks = Array.from(
    source.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url\s*>/giu),
    ([, contents]) => contents ?? ""
  );
  const locations = Array.from(
    source.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc\s*>/giu),
    ([, location]) => location?.trim() ?? ""
  );

  expect(urlOpenings).toHaveLength(expectedSitemapLocations.length);
  expect(urlClosings).toHaveLength(expectedSitemapLocations.length);
  expect(urlBlocks).toHaveLength(expectedSitemapLocations.length);
  expect(locations).toHaveLength(expectedSitemapLocations.length);
  expect([...locations].sort()).toEqual([...expectedSitemapLocations].sort());

  for (const contents of urlBlocks) {
    const locationMatches = Array.from(
      contents.matchAll(/<loc>([\s\S]*?)<\/loc>/giu),
      ([, location]) => location?.trim() ?? ""
    );
    const lastModifiedMatches = Array.from(
      contents.matchAll(/<lastmod>([\s\S]*?)<\/lastmod>/giu),
      ([, lastModified]) => lastModified?.trim() ?? ""
    );

    expect(locationMatches).toHaveLength(1);
    expect(lastModifiedMatches).toEqual(["2026-08-29"]);
    expect(contents.replace(/\s+/gu, "")).toBe(
      `<loc>${locationMatches[0]}</loc><lastmod>2026-08-29</lastmod>`
    );
  }
};

const assertFaviconControls = (source: Buffer) => {
  expect([...source.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(source.subarray(12, 16).toString("ascii")).toBe("IHDR");
  expect(source.readUInt32BE(16)).toBe(64);
  expect(source.readUInt32BE(20)).toBe(64);
  expect(source[24]).toBe(8);
  expect(source[25]).toBe(2);
  expect(sha256(source)).toBe(approvedFaviconSha256);
};

const assertDemoMediaControls = (video: Buffer, poster: Buffer) => {
  expect(video.byteLength).toBeGreaterThan(1_000_000);
  expect(video.subarray(4, 8).toString("ascii")).toBe("ftyp");
  expect(video.includes(Buffer.from("avc1", "ascii"))).toBe(true);
  expect(sha256(video)).toBe(approvedDemoVideoSha256);
  expect(poster.byteLength).toBeGreaterThan(10_000);
  expect([...poster.subarray(0, 3)]).toEqual([255, 216, 255]);
  expect(sha256(poster)).toBe(approvedDemoPosterSha256);
};

describe("static deployment controls", () => {
  it("ships the exact Cloudflare security and crawl controls", async () => {
    const readTextDistFile = (name: string) =>
      readFile(new URL(`../dist/${name}`, import.meta.url), "utf8");
    const [distEntries, headers, robots, sitemap, favicon, brandLogo, demoVideo, demoPoster] = await Promise.all([
      readdir(new URL("../dist/", import.meta.url)),
      readTextDistFile("_headers"),
      readTextDistFile("robots.txt"),
      readTextDistFile("sitemap.xml"),
      readFile(new URL("../dist/favicon.png", import.meta.url)),
      readFile(new URL("../../../assets/brand/logo.png", import.meta.url)),
      readFile(new URL("../dist/demo/cave-app-demo.mp4", import.meta.url)),
      readFile(new URL("../dist/demo/cave-app-demo-poster.jpg", import.meta.url))
    ]);

    expect(distEntries).not.toContain("_redirects");
    assertHeadersControls(headers);
    expect(activeLines(robots)).toEqual([
      "User-agent: *",
      "Allow: /",
      "Sitemap: https://neijiecave.com/sitemap.xml"
    ]);

    assertSitemapControls(sitemap);
    assertFaviconControls(favicon);
    assertDemoMediaControls(demoVideo, demoPoster);
    expect(sha256(brandLogo)).toBe(approvedBrandLogoSha256);
  });
});

describe("static control regression guards", () => {
  it("rejects sitemap entries and metadata outside the exact manifest", async () => {
    const sitemap = await readFile(
      new URL("../dist/sitemap.xml", import.meta.url),
      "utf8"
    );

    assertSitemapControls(sitemap);
    const invalidVariants = [
      sitemap.replace("</url>", "<changefreq>daily</changefreq></url>"),
      sitemap.replace(
        "</urlset>",
        "<url><loc>https://neijiecave.com/extra</loc><lastmod>2026-08-29</lastmod></url></urlset>"
      ),
      sitemap.replace("</urlset>", "<loc>https://neijiecave.com/extra</loc></urlset>"),
      sitemap.replace("<lastmod>2026-08-29</lastmod>", "<lastmod>2026-08-28</lastmod>"),
      sitemap.replace(/ {4}<lastmod>2026-08-29<\/lastmod>\r?\n/u, "")
    ];

    for (const variant of invalidVariants) {
      expect(() => assertSitemapControls(variant)).toThrow();
    }
  });

  it("rejects headers whose Cloudflare rule structure loses indentation", async () => {
    const headers = await readFile(new URL("../dist/_headers", import.meta.url), "utf8");

    assertHeadersControls(headers);
    const invalidVariants = [
      headers.replace("/*", "/privacy"),
      headers.replace("  Referrer-Policy", " Referrer-Policy"),
      headers.replace("  X-Frame-Options", "X-Frame-Options"),
      headers.replace("  X-Frame-Options", "\tX-Frame-Options"),
      headers.replace(
        "  X-Frame-Options: DENY",
        "  Cross-Origin-Resource-Policy: same-origin\n  X-Frame-Options: DENY"
      )
    ];

    for (const variant of invalidVariants) {
      expect(() => assertHeadersControls(variant)).toThrow();
    }
  });
});

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
  "https://neijiecave.com/privacy/",
  "https://neijiecave.com/support/",
  "https://neijiecave.com/safety/",
  "https://neijiecave.com/sources/"
] as const;

const approvedFaviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-labelledby="title description">
  <title id="title">CAVE 内界</title>
  <desc id="description">向内聚拢的抽象回响纹样</desc>
  <rect width="64" height="64" rx="14" fill="#171217"/>
  <path d="M49 14C40 7 24 7 15 17C6 27 8 44 20 52C29 58 42 56 50 48" fill="none" stroke="#6D345A" stroke-width="5" stroke-linecap="round"/>
  <path d="M44 21C37 16 27 16 21 23C15 30 17 41 25 45C31 49 39 47 44 42" fill="none" stroke="#927AA0" stroke-width="4" stroke-linecap="round"/>
  <path d="M39 28C35 25 30 25 27 29C24 33 26 38 30 40C34 42 38 39 40 36" fill="none" stroke="#D7A0B5" stroke-width="3" stroke-linecap="round"/>
  <circle cx="33" cy="33" r="3" fill="#F2C7A5"/>
</svg>
`;

const normalizeFaviconSvg = (source: string) =>
  source.replace(/\r\n/gu, "\n").replace(/\n*$/u, "\n");

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
    expect(lastModifiedMatches).toEqual(["2026-08-28"]);
    expect(contents.replace(/\s+/gu, "")).toBe(
      `<loc>${locationMatches[0]}</loc><lastmod>2026-08-28</lastmod>`
    );
  }
};

const assertFaviconControls = (source: string) => {
  expect(normalizeFaviconSvg(source)).toBe(approvedFaviconSvg);
  expect(source).not.toMatch(/<\s*\/?\s*script\b/iu);
  expect(source).not.toMatch(/<!\s*(?:DOCTYPE|ENTITY)\b/iu);
  expect(
    source.replace(/\s+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/u, "")
  ).not.toMatch(/\b[a-z][a-z\d+.-]*:/iu);
};

describe("static deployment controls", () => {
  it("ships the exact Cloudflare security and crawl controls", async () => {
    const readDistFile = (name: string) =>
      readFile(new URL(`../dist/${name}`, import.meta.url), "utf8");
    const [distEntries, headers, robots, sitemap, favicon] = await Promise.all([
      readdir(new URL("../dist/", import.meta.url)),
      readDistFile("_headers"),
      readDistFile("robots.txt"),
      readDistFile("sitemap.xml"),
      readDistFile("favicon.svg")
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
        "<url><loc>https://neijiecave.com/extra</loc><lastmod>2026-08-28</lastmod></url></urlset>"
      ),
      sitemap.replace("</urlset>", "<loc>https://neijiecave.com/extra</loc></urlset>"),
      sitemap.replace("<lastmod>2026-08-28</lastmod>", "<lastmod>2026-08-27</lastmod>"),
      sitemap.replace(/ {4}<lastmod>2026-08-28<\/lastmod>\r?\n/u, "")
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

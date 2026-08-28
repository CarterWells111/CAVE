import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const indexHtml = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const globalCss = await readFile(new URL("../src/styles/global.css", import.meta.url), "utf8");

const homeTitle = "CAVE 内界｜成年人的身体认知与同意教育";
const homeDescription =
  "探索那些隐于沉默、未被好好说清的事。循着内心的回响，找到属于自己的靠近方式。";

describe("built home page", () => {
  it("ships the required accessible Chinese shell", () => {
    expect(indexHtml).toMatch(/<html[^>]+lang=["']zh-CN["']/u);
    expect(indexHtml).toMatch(/<a[^>]+href=["']#main-content["']/u);
    expect(indexHtml).toContain("© 2026 ZHIQI LIANG");
  });

  it("publishes canonical home metadata and Open Graph tags", () => {
    expect(indexHtml).toContain(`<title>${homeTitle}</title>`);
    expect(indexHtml).toMatch(
      new RegExp(`<meta name=["']description["'] content=["']${homeDescription}["']`, "u")
    );
    expect(indexHtml).toMatch(
      /<link rel=["']canonical["'] href=["']https:\/\/neijiecave\.com\/["']/u
    );
    expect(indexHtml).toMatch(
      new RegExp(`<meta property=["']og:title["'] content=["']${homeTitle}["']`, "u")
    );
    expect(indexHtml).toMatch(
      new RegExp(`<meta property=["']og:description["'] content=["']${homeDescription}["']`, "u")
    );
    expect(indexHtml).toMatch(
      /<meta property=["']og:url["'] content=["']https:\/\/neijiecave\.com\/["']/u
    );
    expect(indexHtml).toMatch(/<meta property=["']og:type["'] content=["']website["']/u);
  });

  it("renders all navigation and support destinations", () => {
    const primaryNavigation =
      indexHtml.match(/<nav[^>]+aria-label=["']主要导航["'][^>]*>(.*?)<\/nav>/su)?.[1] ?? "";
    const destinations = [
      ["/", "了解 CAVE"],
      ["/privacy/", "隐私"],
      ["/support/", "支持"],
      ["/safety/", "安全"],
      ["/sources/", "内容来源"]
    ] as const;

    expect(primaryNavigation).not.toBe("");
    expect([...primaryNavigation.matchAll(/<a\b/gu)]).toHaveLength(5);

    for (const [href, label] of destinations) {
      expect(primaryNavigation).toMatch(
        new RegExp(`<a[^>]+href=["']${href}["'][^>]*>${label}</a>`, "u")
      );
    }

    expect(indexHtml).toMatch(
      /<a[^>]+href=["']mailto:support@neijiecave\.com["'][^>]*>support@neijiecave\.com<\/a>/u
    );
  });

  it("identifies the current page and gives shell links two-dimensional targets", () => {
    expect(indexHtml).toMatch(
      /<a[^>]+href=["']\/["'][^>]+aria-current=["']page["'][^>]*>了解 CAVE<\/a>/u
    );
    expect(globalCss).toMatch(
      /\.site-header a,\s*\.site-footer a\s*\{[^}]*min-height:\s*var\(--target-min\);[^}]*min-width:\s*var\(--target-min\);/su
    );
  });

  it("does not include scripts, analytics, or tracking vendors", () => {
    expect(indexHtml).not.toMatch(/<script\b/iu);
    expect(indexHtml).not.toMatch(
      /google-analytics|googletagmanager|segment|mixpanel|hotjar|facebook\.net/iu
    );
  });
});

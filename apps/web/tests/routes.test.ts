import { readFile } from "node:fs/promises";

import { JOURNEY_SOURCE_REGISTRY } from "@cave/content";
import { describe, expect, it } from "vitest";

import { experienceSteps, principles } from "../src/content/site";

const routeNames = ["", "privacy", "support", "safety", "sources"] as const;

const expectedCanonicals = [
  "https://neijiecave.com/",
  "https://neijiecave.com/privacy/",
  "https://neijiecave.com/support/",
  "https://neijiecave.com/safety/",
  "https://neijiecave.com/sources/"
] as const;

const supportBoundary =
  "support@neijiecave.com 不是紧急服务，也不提供医疗诊断、法律代理或危机干预。";
const safetyBoundary =
  "CAVE 是成年人身体认知与同意教育工具，不是医疗器械，不提供诊断或治疗，也不会判断你是否“准备好”。紧急情况下，请联系你所在地的紧急服务。";
const sharingBoundary =
  "不会。预览、保存或复制都不等于发送，分享必须由你主动完成。";

const readRoute = async (route: (typeof routeNames)[number]) =>
  readFile(new URL(`../dist/${route}/index.html`, import.meta.url), "utf8");

const attribute = (tag: string, name: string) => {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return tag.match(new RegExp(`\\b${escapedName}=["']([^"']+)["']`, "u"))?.[1];
};

const tags = (html: string, name: string) =>
  Array.from(html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "giu")), ([tag]) => tag);

const metaContent = (html: string, property: string) =>
  tags(html, "meta")
    .filter((tag) => attribute(tag, "property") === property)
    .map((tag) => attribute(tag, "content"));

const namedMetaContent = (html: string, name: string) =>
  tags(html, "meta")
    .filter((tag) => attribute(tag, "name") === name)
    .map((tag) => attribute(tag, "content"));

const headingTexts = (html: string) =>
  Array.from(html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gu))
    .map((match) => match[1])
    .filter((contents): contents is string => contents !== undefined)
    .map((contents) => contents.replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim());

const textContent = (html: string) =>
  html
    .replace(/<[^>]+>/gu, " ")
    .replace(/&amp;|&#(?:0*38|x0*26);/giu, "&")
    .replace(/\s+/gu, " ")
    .trim();

describe("official site routes", () => {
  it("builds five complete, distinct, static routes with matching metadata", async () => {
    const htmlDocuments = await Promise.all(routeNames.map(readRoute));
    const titles: string[] = [];
    const descriptions: string[] = [];

    for (const [index, html] of htmlDocuments.entries()) {
      const canonicalTags = tags(html, "link").filter(
        (tag) => attribute(tag, "rel") === "canonical"
      );
      const titleMatches = Array.from(html.matchAll(/<title>([\s\S]*?)<\/title>/gu));
      const title = titleMatches[0]?.[1]?.trim();
      const descriptionMatches = namedMetaContent(html, "description");
      const description = descriptionMatches[0];

      expect(canonicalTags).toHaveLength(1);
      expect(attribute(canonicalTags[0] ?? "", "href")).toBe(expectedCanonicals[index]);
      expect(titleMatches).toHaveLength(1);
      expect(title).toBeTruthy();
      expect(descriptionMatches).toHaveLength(1);
      expect(description).toBeTruthy();
      expect(metaContent(html, "og:title")).toEqual([title]);
      expect(metaContent(html, "og:description")).toEqual([description]);
      expect(metaContent(html, "og:url")).toEqual([expectedCanonicals[index]]);
      const faviconTags = tags(html, "link").filter(
        (tag) => attribute(tag, "rel") === "icon"
      );
      expect(faviconTags).toHaveLength(1);
      expect(attribute(faviconTags[0] ?? "", "href")).toBe("/favicon.png");
      expect(attribute(faviconTags[0] ?? "", "type")).toBe("image/png");
      expect(html).toMatch(/<html\b[^>]*\blang=["']zh-CN["']/u);
      expect(html).toMatch(/<a\b[^>]*\bclass=["'][^"']*skip-link[^"']*["'][^>]*\bhref=["']#main-content["']/u);
      expect(html).toMatch(/<footer\b/u);
      expect(html).not.toMatch(/<script\b/iu);
      expect(html).not.toMatch(/<(?:img|iframe|video|audio|source)\b[^>]*\b(?:src|srcset)=["']https?:/iu);
      expect(
        tags(html, "link")
          .filter((tag) => attribute(tag, "rel") !== "canonical")
          .some((tag) => /^https?:/u.test(attribute(tag, "href") ?? ""))
      ).toBe(false);
      expect(html).not.toMatch(/\bhref=["'](?:|#|javascript:[^"']*)["']/iu);

      if (title !== undefined) titles.push(title);
      if (description !== undefined) descriptions.push(description);
    }

    expect(titles).toHaveLength(routeNames.length);
    expect(new Set(titles)).toHaveLength(routeNames.length);
    expect(descriptions).toHaveLength(routeNames.length);
    expect(new Set(descriptions)).toHaveLength(routeNames.length);
    const allSiteText = textContent(htmlDocuments.join("\n"));
    expect(allSiteText).not.toMatch(
      /\bAI\b|人工智能|云同步|App\s*Store|Google\s*Play|应用商店|商店徽章|立即下载|下载(?:\s*App|应用)/iu
    );
  });

  it("publishes the approved homepage journey without download calls to action", async () => {
    const html = await readRoute("");

    expect(html).toContain("Consent · Awareness · Voice · Exploration");
    expect(html).toContain("CAVE 内界");
    expect(html).toContain("探索那些隐于沉默、未被好好说清的事。");
    expect(html).toContain("期待、紧张和犹豫，可以同时存在。");
    expect(html).toContain("18 岁及以上成年人");
    expect(html.match(/data-principle/gu) ?? []).toHaveLength(principles.length);
    for (const principle of principles) expect(textContent(html)).toContain(principle);

    expect(html.match(/data-experience-step/gu) ?? []).toHaveLength(experienceSteps.length);
    for (const [, title, description] of experienceSteps) {
      expect(textContent(html)).toContain(title);
      expect(textContent(html)).toContain(description);
    }

    const homeCallouts = Array.from(
      html.matchAll(/<section\b[^>]*\bdata-home-callout\b[^>]*>([\s\S]*?)<\/section>/gu),
      ([, contents = ""]) => contents
    );
    expect(homeCallouts).toHaveLength(1);
    const homeCallout = homeCallouts[0] ?? "";
    expect(homeCallout).toContain('href="/privacy/"');
    expect(homeCallout).toContain('href="/support/"');
    expect(textContent(homeCallout)).toContain(
      "首版无需账号。你的旅程内容默认只保存在当前设备，并由你决定是否导出。"
    );
    expect(textContent(homeCallout)).toContain(
      "查看常见问题、删除说明、联系渠道，以及 CAVE 能做与不能做的事。"
    );
    expect(html).not.toMatch(/立即下载|App\s*Store|Google\s*Play|商店徽章|下载(?:应用|App)|AI\s*对话|云同步/iu);
  });

  it("builds a noindex 404 document outside the five canonical routes", async () => {
    const [html, sitemap] = await Promise.all([
      readFile(new URL("../dist/404.html", import.meta.url), "utf8"),
      readFile(new URL("../dist/sitemap.xml", import.meta.url), "utf8")
    ]);
    const titleMatches = Array.from(html.matchAll(/<title>([\s\S]*?)<\/title>/gu));
    const title = titleMatches[0]?.[1]?.trim();
    const descriptions = namedMetaContent(html, "description");
    const canonicalTags = tags(html, "link").filter(
      (tag) => attribute(tag, "rel") === "canonical"
    );

    expect(titleMatches).toHaveLength(1);
    expect(title).toBe("页面不存在｜CAVE 内界");
    expect(descriptions).toEqual(["这个页面不存在或已经移动。返回 CAVE 内界首页，或前往支持页面继续查找。"]);
    expect(namedMetaContent(html, "robots")).toEqual(["noindex"]);
    expect(canonicalTags).toHaveLength(1);
    expect(attribute(canonicalTags[0] ?? "", "href")).toBe("https://neijiecave.com/404");
    expect(metaContent(html, "og:title")).toEqual([title]);
    expect(metaContent(html, "og:description")).toEqual(descriptions);
    expect(metaContent(html, "og:url")).toEqual(["https://neijiecave.com/404"]);
    expect(html).toMatch(/<html\b[^>]*\blang=["']zh-CN["']/u);
    expect(textContent(html)).toContain("页面不存在");
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/support/"');
    expect(html).toMatch(/<footer\b/u);
    expect(html).not.toMatch(/<script\b/iu);
    expect(expectedCanonicals).not.toContain("https://neijiecave.com/404");
    expect(sitemap).not.toContain("https://neijiecave.com/404");
  });

  it("preserves semantics for every markerless navigation and content list", async () => {
    const [homeHtml, privacyHtml, supportHtml, safetyHtml, sourcesHtml] = await Promise.all(
      routeNames.map(readRoute)
    );
    const homePrinciples = tags(homeHtml ?? "", "ul").filter((tag) =>
      (attribute(tag, "class") ?? "").split(/\s+/u).includes("card-grid")
    );
    const homeJourneys = tags(homeHtml ?? "", "ol").filter((tag) =>
      (attribute(tag, "class") ?? "").split(/\s+/u).includes("journey-grid")
    );
    const privacyLists = tags(privacyHtml ?? "", "ul").filter((tag) =>
      (attribute(tag, "class") ?? "").split(/\s+/u).includes("privacy-list")
    );
    const safetyLists = tags(safetyHtml ?? "", "ul").filter((tag) =>
      /\bdata-safety-principles\b/u.test(tag)
    );

    expect(homePrinciples).toHaveLength(1);
    expect(homePrinciples.map((tag) => attribute(tag, "role"))).toEqual(["list"]);
    expect(homeJourneys).toHaveLength(1);
    expect(homeJourneys.map((tag) => attribute(tag, "role"))).toEqual(["list"]);
    expect(privacyLists).toHaveLength(1);
    expect(privacyLists.map((tag) => attribute(tag, "role"))).toEqual(["list"]);
    expect(safetyLists).toHaveLength(1);
    expect(safetyLists.map((tag) => attribute(tag, "role"))).toEqual(["list"]);

    for (const html of [homeHtml, privacyHtml, supportHtml, safetyHtml, sourcesHtml]) {
      const navigationBlocks = Array.from(
        (html ?? "").matchAll(/<nav\b[^>]*>([\s\S]*?)<\/nav>/gu),
        ([, contents = ""]) => contents
      );
      expect(navigationBlocks).toHaveLength(2);
      for (const navigation of navigationBlocks) {
        const navigationLists = tags(navigation, "ul");
        expect(navigationLists).toHaveLength(1);
        expect(attribute(navigationLists[0] ?? "", "role")).toBe("list");
      }
    }
  });

  it("states privacy ownership, retention, deletion, and system-service boundaries", async () => {
    const html = await readRoute("privacy");

    expect(html).toContain("首版无需账号或登录");
    expect(html.match(/data-privacy-point/gu) ?? []).toHaveLength(6);
    expect(html).toContain("保留");
    expect(html).toContain("删除");
    expect(html).toContain("Apple");
    expect(html).toContain("系统相册");
    expect(html).toContain("系统剪贴板");
    expect(html).toContain("ZHIQI LIANG（以内界 CAVE 名义运营）");
    expect(html).toContain("support@neijiecave.com");
    expect(html).toMatch(/<h1\b[^>]*\bid=["']privacy-title["']/u);
    expect(html.match(/\baria-labelledby=["']privacy-title["']/gu) ?? []).toHaveLength(1);
    expect(html).toMatch(/<section\b[^>]*\baria-labelledby=["']privacy-method-title["'][^>]*>/u);
    expect(html).toMatch(/<h2\b[^>]*\bid=["']privacy-method-title["']/u);
  });

  it("publishes complete support and safety boundaries", async () => {
    const [supportHtml, safetyHtml] = await Promise.all([
      readRoute("support"),
      readRoute("safety")
    ]);

    expect(supportHtml.match(/data-faq/gu) ?? []).toHaveLength(5);
    expect(supportHtml).toContain('href="mailto:support@neijiecave.com"');
    expect(supportHtml).toContain("再次确认后完成清除");
    expect(textContent(supportHtml)).toContain(sharingBoundary);
    expect(textContent(supportHtml)).toContain(supportBoundary);
    expect(safetyHtml.match(/data-principle/gu) ?? []).toHaveLength(4);
    expect(safetyHtml).toContain("18 岁及以上成年人");
    expect(textContent(safetyHtml)).toContain(safetyBoundary);
    expect(textContent(safetyHtml)).not.toMatch(/110|120|12338|12348/u);
    expect(safetyHtml).toMatch(/<h2\b[^>]*\bid=["']safety-principles-title["']/u);
    const safetyPrincipleSections = Array.from(
      safetyHtml.matchAll(
        /<section\b[^>]*\baria-labelledby=["']safety-principles-title["'][^>]*>([\s\S]*?)<\/section>/gu
      ),
      ([, contents = ""]) => contents
    );
    expect(safetyPrincipleSections).toHaveLength(1);
    const safetyPrincipleLists = Array.from(
      (safetyPrincipleSections[0] ?? "").matchAll(
        /<ul\b[^>]*\bdata-safety-principles\b[^>]*>([\s\S]*?)<\/ul>/gu
      ),
      ([, contents = ""]) => contents
    );
    expect(safetyPrincipleLists).toHaveLength(1);
    expect(tags(safetyPrincipleLists[0] ?? "", "li")).toHaveLength(principles.length);
  });

  it("renders every verified registry source in exact EDU, MED, and SAFE groups", async () => {
    const html = await readRoute("sources");
    const headings = headingTexts(html);
    const sourceCards = Array.from(
      html.matchAll(/<article\b([^>]*)\bdata-source-id=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/article>/gu),
      ([, beforeId = "", id = "", afterId = "", contents = ""]) => ({
        openingAttributes: `${beforeId} ${afterId}`,
        id,
        contents
      })
    );

    expect(headings.some((heading) => heading.includes("EDU"))).toBe(true);
    expect(headings.some((heading) => heading.includes("MED"))).toBe(true);
    expect(
      headings.some(
        (heading) => heading.includes("SAFE") && heading.includes("中国大陆安全与支持资源")
      )
    ).toBe(true);
    expect(sourceCards).toHaveLength(JOURNEY_SOURCE_REGISTRY.length);

    const expectedGroupCounts = { EDU: 3, MED: 8, SAFE: 3 } as const;
    const sourceGroups = Array.from(
      html.matchAll(
        /<section\b([^>]*)\bdata-source-group=["'](EDU|MED|SAFE)["']([^>]*)>([\s\S]*?)<\/section>/gu
      ),
      ([, beforeType = "", sourceType = "", afterType = "", contents = ""]) => ({
        openingAttributes: `${beforeType} ${afterType}`,
        sourceType,
        contents
      })
    );
    expect.soft(sourceGroups).toHaveLength(3);
    for (const [sourceType, expectedCount] of Object.entries(expectedGroupCounts)) {
      const groups = sourceGroups.filter((group) => group.sourceType === sourceType);
      expect.soft(groups).toHaveLength(1);
      const groupCards = Array.from(
        (groups[0]?.contents ?? "").matchAll(/<article\b([^>]*)>/gu),
        ([, openingAttributes = ""]) => openingAttributes
      ).filter((openingAttributes) => attribute(`<article ${openingAttributes}>`, "data-source-id"));
      expect.soft(groupCards).toHaveLength(expectedCount);
      expect.soft(
        groupCards.every((openingAttributes) => (
          attribute(`<article ${openingAttributes}>`, "data-source-type") === sourceType
        ))
      ).toBe(true);
    }

    for (const source of JOURNEY_SOURCE_REGISTRY) {
      const sourceUrl = new URL(source.url);
      expect(sourceUrl.protocol).toBe("https:");
      const cards = sourceCards.filter(({ id }) => id === source.id);
      expect(cards).toHaveLength(1);
      const card = cards[0];
      const cardText = textContent(card?.contents ?? "");
      expect(attribute(`<article ${card?.openingAttributes ?? ""}>`, "data-source-type")).toBe(
        source.sourceType
      );
      expect(cardText).toContain(source.id);
      expect(cardText).toContain(source.title);
      expect(cardText).toContain(source.organization);
      expect(cardText).toContain(source.publicationOrReviewDate);
      expect(cardText).toContain(source.accessedAt);
      expect(cardText).toContain(source.appliesTo);
      expect(card?.contents).toContain("来源链接已核验");
      expect(card?.contents).toContain(`href="${source.url}"`);
      expect(card?.contents).toContain("原始直链");
      const originalLinks = Array.from(
        (card?.contents ?? "").matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gu),
        ([, openingAttributes = "", contents = ""]) => ({ openingAttributes, contents })
      ).filter(({ contents }) => textContent(contents) === "原始直链");
      expect(originalLinks).toHaveLength(1);
      const originalLink = originalLinks[0];
      const renderedHref = attribute(`<a ${originalLink?.openingAttributes ?? ""}>`, "href");
      expect(new URL(renderedHref ?? "http://invalid").protocol).toBe("https:");
      expect(
        textContent(attribute(`<a ${originalLink?.openingAttributes ?? ""}>`, "aria-label") ?? "")
      ).toContain(source.title);
      expect(source.verificationStatus).toBe("source_verified");
    }

    const groupCounts = Object.fromEntries(
      ["EDU", "MED", "SAFE"].map((sourceType) => [
        sourceType,
        sourceCards.filter(({ openingAttributes }) =>
          attribute(`<article ${openingAttributes}>`, "data-source-type") === sourceType
        ).length
      ])
    );
    expect(groupCounts).toEqual(expectedGroupCounts);
    expect(html).toContain("来源已核验不代表中文改写已经通过专家复核。");
  });
});

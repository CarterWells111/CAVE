# 内界 CAVE Static Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved five-page Simplified Chinese official website as a static Astro site inside the existing pnpm monorepo.

**Architecture:** `apps/web` owns rendering, metadata, accessibility, and Cloudflare static files. Product and policy copy stays in one typed content module, while medical and education sources reuse the canonical `@cave/content` registry so the website cannot silently drift from the App. The site has no client-side JavaScript, account system, forms, tracking, database, or runtime secrets.

**Tech Stack:** Astro 7.2, TypeScript 5.9, Vitest 4, pnpm 10, Cloudflare Pages static assets

---

## File map

- `packages/content/src/index.ts`: expose the existing canonical source registry.
- `packages/content/src/public-surface.test.ts`: protect the public source-registry export.
- `apps/web/package.json`: package scripts and exact dependencies.
- `apps/web/astro.config.mjs`: production origin and fully static output.
- `apps/web/tsconfig.json`, `apps/web/src/env.d.ts`, `apps/web/vitest.config.ts`: type and test configuration.
- `apps/web/src/content/site.ts`: all brand, navigation, policy, FAQ, and experience copy.
- `apps/web/src/layouts/BaseLayout.astro`: HTML shell, metadata, skip link, header, footer.
- `apps/web/src/components/*.astro`: focused presentational units.
- `apps/web/src/styles/global.css`: tokens, layout, responsive rules, focus, reduced motion.
- `apps/web/src/pages/*.astro`: the five routes.
- `apps/web/public/*`: Cloudflare headers/redirects, robots, sitemap, favicon.
- `apps/web/tests/*.test.ts`: content and production-output contracts.
- `package.json`: root convenience scripts only.

### Task 1: Export the canonical source registry

**Files:**
- Modify: `packages/content/src/index.ts`
- Create: `packages/content/src/public-surface.test.ts`

- [ ] **Step 1: Write the failing public-surface test**

```ts
import { describe, expect, it } from "vitest";

import { JOURNEY_SOURCE_REGISTRY } from "./index";

describe("public source registry", () => {
  it("exports the reviewed registry without duplicate IDs", () => {
    expect(JOURNEY_SOURCE_REGISTRY).toHaveLength(13);
    expect(new Set(JOURNEY_SOURCE_REGISTRY.map(({ id }) => id)).size).toBe(13);
    expect(JOURNEY_SOURCE_REGISTRY.every(({ verificationStatus }) => verificationStatus === "source_verified")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and verify the export is missing**

Run: `pnpm --filter @cave/content test -- public-surface.test.ts`

Expected: FAIL because `JOURNEY_SOURCE_REGISTRY` is not exported from `./index`.

- [ ] **Step 3: Add the minimal export**

Append to `packages/content/src/index.ts`:

```ts
export { JOURNEY_SOURCE_REGISTRY } from "./source-registry";
```

- [ ] **Step 4: Run focused and package verification**

Run: `pnpm --filter @cave/content test -- public-surface.test.ts`

Expected: PASS, one test file.

Run: `pnpm --filter @cave/content typecheck`

Expected: exit 0.

- [ ] **Step 5: Commit the source-registry boundary**

```bash
git add packages/content/src/index.ts packages/content/src/public-surface.test.ts
git commit -m "feat(content): expose reviewed source registry"
```

### Task 2: Scaffold the static Astro package

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/astro.config.mjs`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/src/env.d.ts`
- Create: `apps/web/vitest.config.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Create the package manifest**

```json
{
  "name": "@cave/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "typecheck": "astro check",
    "lint": "eslint src tests --max-warnings 0",
    "test": "astro build && vitest run"
  },
  "dependencies": {
    "@cave/content": "workspace:*",
    "astro": "^7.2.0"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.6",
    "typescript": "~5.9.3",
    "vitest": "^4.0.18"
  }
}
```

- [ ] **Step 2: Create strict static configuration**

`apps/web/astro.config.mjs`:

```js
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://neijiecave.com",
  output: "static",
  trailingSlash: "never",
  build: {
    format: "directory",
    inlineStylesheets: "never"
  }
});
```

`apps/web/tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  }
}
```

`apps/web/src/env.d.ts`:

```ts
/// <reference types="astro/client" />
```

`apps/web/vitest.config.ts`:

```ts
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: { include: ["tests/**/*.test.ts"] }
});
```

- [ ] **Step 3: Add root convenience scripts**

Add to the root `package.json` scripts:

```json
"dev:web": "pnpm --filter @cave/web dev",
"build:web": "pnpm --filter @cave/web build"
```

- [ ] **Step 4: Install and verify the empty package**

Run: `pnpm install`

Expected: `pnpm-lock.yaml` records Astro 7.2-compatible dependencies without changing the package manager.

Run: `pnpm --filter @cave/web typecheck`

Expected: exit 0.

- [ ] **Step 5: Commit the scaffold**

```bash
git add apps/web/package.json apps/web/astro.config.mjs apps/web/tsconfig.json apps/web/src/env.d.ts apps/web/vitest.config.ts package.json pnpm-lock.yaml
git commit -m "build(web): scaffold static Astro site"
```

### Task 3: Lock approved copy in a typed content module

**Files:**
- Create: `apps/web/src/content/site.ts`
- Create: `apps/web/tests/content.test.ts`

- [ ] **Step 1: Write failing content contracts**

```ts
import { describe, expect, it } from "vitest";

import { experienceSteps, navItems, principles, site } from "../src/content/site";

describe("official site content", () => {
  it("uses the approved identity and five routes", () => {
    expect(site).toMatchObject({ name: "内界 CAVE", owner: "ZHIQI LIANG", origin: "https://neijiecave.com" });
    expect(navItems.map(({ href }) => href)).toEqual(["/", "/privacy", "/support", "/safety", "/sources"]);
  });

  it("keeps the consent principles and seven-step scope", () => {
    expect(principles).toContain("身体反应不等于同意。");
    expect(experienceSteps).toHaveLength(7);
    expect(JSON.stringify({ experienceSteps, principles })).not.toMatch(/AI|登录|云同步|准备度分数/u);
  });
});
```

- [ ] **Step 2: Run the test and verify the module is missing**

Run: `pnpm --filter @cave/web exec vitest run tests/content.test.ts`

Expected: FAIL because `src/content/site.ts` does not exist.

- [ ] **Step 3: Implement the exact approved content model**

Create `apps/web/src/content/site.ts`:

```ts
export const site = Object.freeze({
  name: "内界 CAVE",
  owner: "ZHIQI LIANG",
  origin: "https://neijiecave.com",
  supportEmail: "support@neijiecave.com",
  eyebrow: "Consent · Awareness · Voice · Exploration",
  statement: "探索那些隐于沉默、未被好好说清的事。循着内心的回响，找到属于自己的靠近方式。",
  reassurance: "期待、紧张和犹豫，可以同时存在。",
  updatedAt: "2026-08-28"
});

export const navItems = Object.freeze([
  { href: "/", label: "了解 CAVE" },
  { href: "/privacy", label: "隐私" },
  { href: "/support", label: "支持" },
  { href: "/safety", label: "安全" },
  { href: "/sources", label: "内容来源" }
]);

export const principles = Object.freeze([
  "身体反应不等于同意。",
  "同意针对具体行为，并且持续、可以撤回。",
  "期待、紧张和犹豫可以同时存在。",
  "私密探索默认留在用户自己的设备上。"
]);

export const experienceSteps = Object.freeze([
  ["01", "成年确认", "确认这是面向 18 岁及以上成年人的体验。"],
  ["02", "看见期待与在意", "共同过夜不代表任何事情必须发生。"],
  ["03", "认识身体", "通过有来源、非色情的内容认识身体与常见差异。"],
  ["04", "分别感受每种靠近", "对不同靠近方式逐一留下此刻的感受。"],
  ["05", "听见自己的需要", "回看答案、表达难度与让自己更安心的条件。"],
  ["06", "练习放慢或暂停", "用预设情境练习改变、暂停或撤回同意。"],
  ["07", "整理并决定是否分享", "把私人准备与可给对方看的沟通卡清楚分开。"]
]);

export const privacyPoints = Object.freeze([
  "首版无需账号或登录，也不会在 App 中收集邮箱地址。",
  "旅程选择、反思记录、练习结果、沟通卡和界面偏好保存在本机加密数据库中。",
  "CAVE 不把这些内容上传到自有服务器，也不用于广告、画像或行为分析。",
  "只有在你主动操作时，沟通卡图片才会进入系统相册，文字才会进入系统剪贴板。",
  "设备备份、相册同步和剪贴板由 Apple 与你的设备设置控制。"
]);

export const supportFaq = Object.freeze([
  ["使用 CAVE 需要账号吗？", "不需要。首版可以直接使用，不创建远程账号。"],
  ["内容会自动发给别人吗？", "不会。预览、保存或复制都不等于发送，分享必须由你主动完成。"],
  ["怎样删除本机数据？", "在 App 的“设置”中选择“删除全部本机数据”，再次确认后完成清除。"],
  ["卸载等于删除吗？", "卸载行为由 iOS 管理。需要确定清除 CAVE 管理的数据时，请先使用 App 内的删除功能。"],
  ["为什么只面向成年人？", "当前内容和情境仅为 18 岁及以上成年人设计。"]
]);
```

- [ ] **Step 4: Run the content test**

Run: `pnpm --filter @cave/web exec vitest run tests/content.test.ts`

Expected: PASS, two tests.

- [ ] **Step 5: Commit approved copy**

```bash
git add apps/web/src/content/site.ts apps/web/tests/content.test.ts
git commit -m "feat(web): add approved site content"
```

### Task 4: Build the shared shell and visual system

**Files:**
- Create: `apps/web/src/layouts/BaseLayout.astro`
- Create: `apps/web/src/components/SiteHeader.astro`
- Create: `apps/web/src/components/SiteFooter.astro`
- Create: `apps/web/src/components/EchoBackdrop.astro`
- Create: `apps/web/src/styles/global.css`
- Create: `apps/web/src/pages/index.astro`

- [ ] **Step 1: Create a failing production-shell test**

Create `apps/web/tests/dist.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const readRoute = async (route: string) => readFile(new URL(`../dist/${route}/index.html`, import.meta.url), "utf8");

describe("production site", () => {
  it("renders a Chinese, no-tracking document shell", async () => {
    const html = await readRoute("");
    expect(html).toContain('<html lang="zh-CN">');
    expect(html).toContain('href="#main-content"');
    expect(html).toContain("© 2026 ZHIQI LIANG");
    expect(html).not.toMatch(/google-analytics|googletagmanager|segment|mixpanel|hotjar|facebook\.net/u);
  });
});
```

- [ ] **Step 2: Run the test and verify there is no home output**

Run: `pnpm --filter @cave/web test`

Expected: FAIL because `src/pages/index.astro` and `dist/index.html` do not exist.

- [ ] **Step 3: Implement the semantic shell**

`BaseLayout.astro` must accept `{ title, description, path }`, compute `new URL(path, site.origin)`, render unique title/description/canonical/Open Graph tags, a skip link, `SiteHeader`, `<main id="main-content">`, and `SiteFooter`. It imports `global.css` and sets `<html lang="zh-CN">`.

`SiteHeader.astro` renders the brand link and the five `navItems` in a semantic `<nav aria-label="主要导航">`. Use a wrapping list instead of a JavaScript hamburger so navigation remains usable with scripts disabled.

`SiteFooter.astro` renders the five policy links, a `mailto:support@neijiecave.com` link, `© 2026 ZHIQI LIANG`, and `最后更新：2026-08-28`.

`EchoBackdrop.astro` renders three `aria-hidden="true"` spans only; they carry no text or interaction.

Create a minimal `index.astro` that renders `BaseLayout` with the homepage title, description, and `/` path, then includes the approved eyebrow, `CAVE 内界`, and reassurance. Task 5 will expand this page after the shared shell is green.

- [ ] **Step 4: Implement the approved CSS tokens and behavior**

`global.css` must define the approved color variables, `color-scheme: dark`, a 72rem content maximum, 44px minimum targets, visible `:focus-visible`, fluid type with `clamp()`, grid cards, and mobile single-column rules. Add:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}

@media (max-width: 48rem) {
  .grid, .hero-grid { grid-template-columns: 1fr; }
  .site-nav ul { justify-content: flex-start; }
}
```

Use only `#171217`, `#1D161C`, `#241A22`, `#30222D`, `#4A3944`, `#FAF5F7`, `#CBBFC5`, `#6D345A`, `#D7A0B5`, `#927AA0`, and `#F2C7A5` for the principal theme. Do not add stock photography or the unreviewed medical image.

- [ ] **Step 5: Build, run the shell test, and commit**

Run: `pnpm --filter @cave/web test`

Expected: PASS for the content and production-shell contracts.

```bash
git add apps/web/src/layouts apps/web/src/components apps/web/src/styles apps/web/src/pages/index.astro apps/web/tests/dist.test.ts
git commit -m "feat(web): add accessible brand shell"
```

### Task 5: Implement the five routes

**Files:**
- Create: `apps/web/src/components/PageHero.astro`
- Create: `apps/web/src/components/ContentCard.astro`
- Modify: `apps/web/src/pages/index.astro`
- Create: `apps/web/src/pages/privacy.astro`
- Create: `apps/web/src/pages/support.astro`
- Create: `apps/web/src/pages/safety.astro`
- Create: `apps/web/src/pages/sources.astro`
- Modify: `apps/web/tests/dist.test.ts`

- [ ] **Step 1: Extend the failing route contract**

Add to `dist.test.ts`:

```ts
it("builds all required routes with honest metadata and copy", async () => {
  const routes = ["", "privacy", "support", "safety", "sources"];
  const html = await Promise.all(routes.map(readRoute));
  expect(html.every((page) => page.includes("https://neijiecave.com"))).toBe(true);
  expect(html[0]).toContain("期待、紧张和犹豫，可以同时存在。");
  expect(html[1]).toContain("首版无需账号或登录");
  expect(html[2]).toContain("support@neijiecave.com");
  expect(html[3]).toContain("不是医疗器械");
  expect(html[4]).toContain("来源已核验不代表中文改写已经通过专家复核");
  expect(html.join("\n")).not.toMatch(/立即下载|App Store 下载|AI 对话|云同步/u);
});
```

- [ ] **Step 2: Run the test and verify routes are missing**

Run: `pnpm --filter @cave/web test`

Expected: FAIL on the first missing route.

- [ ] **Step 3: Implement the home page**

Use `BaseLayout`, `PageHero`, `ContentCard`, `EchoBackdrop`, `principles`, and `experienceSteps`. Render the approved eyebrow, `CAVE 内界`, statement, reassurance, `面向 18 岁及以上成年人`, four principles, seven numbered cards, and a privacy callout linking to `/privacy` and `/support`. Do not add a download CTA.

- [ ] **Step 4: Implement policy and support pages**

`privacy.astro` renders `privacyPoints`, a section for retention/deletion, a section for device-controlled services, and `ZHIQI LIANG（以内界 CAVE 名义运营）` with the support email.

`support.astro` renders `supportFaq`, the mail link, scope of support, and: `support@neijiecave.com 不是紧急服务，也不提供医疗诊断、法律代理或危机干预。`

`safety.astro` renders the four consent principles and: `CAVE 是成年人身体认知与同意教育工具，不是医疗器械，不提供诊断或治疗，也不会判断你是否“准备好”。紧急情况下，请联系你所在地的紧急服务。`

`sources.astro` imports `JOURNEY_SOURCE_REGISTRY` from `@cave/content`, groups entries by `sourceType`, renders organization/title/date/access date/applicability/direct link, and shows: `来源已核验不代表中文改写已经通过专家复核。`

- [ ] **Step 5: Build and run all web tests**

Run: `pnpm --filter @cave/web test`

Expected: PASS for content and production-output contracts.

- [ ] **Step 6: Commit the routes**

```bash
git add apps/web/src/components apps/web/src/pages apps/web/tests/dist.test.ts
git commit -m "feat(web): add official content and policy pages"
```

### Task 6: Add Cloudflare static controls and crawl metadata

**Files:**
- Create: `apps/web/public/_headers`
- Create: `apps/web/public/_redirects`
- Create: `apps/web/public/robots.txt`
- Create: `apps/web/public/sitemap.xml`
- Create: `apps/web/public/favicon.svg`
- Modify: `apps/web/tests/dist.test.ts`

- [ ] **Step 1: Add failing static-control assertions**

```ts
it("ships Cloudflare security, redirect, and crawl controls", async () => {
  const [headers, redirects, robots, sitemap] = await Promise.all(
    ["_headers", "_redirects", "robots.txt", "sitemap.xml"].map((name) =>
      readFile(new URL(`../dist/${name}`, import.meta.url), "utf8")
    )
  );
  expect(headers).toContain("Content-Security-Policy: default-src 'self'");
  expect(headers).toContain("X-Content-Type-Options: nosniff");
  expect(redirects).toContain("https://www.neijiecave.com/* https://neijiecave.com/:splat 301");
  expect(robots).toContain("Sitemap: https://neijiecave.com/sitemap.xml");
  for (const path of ["/", "/privacy", "/support", "/safety", "/sources"]) expect(sitemap).toContain(`<loc>https://neijiecave.com${path}</loc>`);
});
```

- [ ] **Step 2: Run and verify the controls are absent**

Run: `pnpm --filter @cave/web test`

Expected: FAIL reading `dist/_headers`.

- [ ] **Step 3: Add exact Cloudflare controls**

`public/_headers`:

```text
/*
  Content-Security-Policy: default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self'; form-action 'none'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'none'; style-src 'self'; upgrade-insecure-requests
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=(), usb=()
```

`public/_redirects`:

```text
https://www.neijiecave.com/* https://neijiecave.com/:splat 301
```

`robots.txt` allows all crawlers and points to the production sitemap. `sitemap.xml` lists exactly the five canonical URLs with `lastmod` `2026-08-28`. `favicon.svg` is a minimal accessible brand mark using the approved warm-charcoal background and the letters `CAVE`; it contains no scripts, external references, people, anatomy, or imagery.

- [ ] **Step 4: Run build and tests**

Run: `pnpm --filter @cave/web test`

Expected: PASS.

- [ ] **Step 5: Commit production controls**

```bash
git add apps/web/public apps/web/tests/dist.test.ts
git commit -m "feat(web): add static security and crawl controls"
```

### Task 7: Final local verification and handoff

**Files:**
- Modify only if verification exposes a real defect.

- [ ] **Step 1: Run scoped quality gates**

Run: `pnpm --filter @cave/content test`

Expected: PASS.

Run: `pnpm --filter @cave/web typecheck`

Expected: exit 0.

Run: `pnpm --filter @cave/web lint`

Expected: exit 0 with zero warnings.

Run: `pnpm --filter @cave/web test`

Expected: PASS after a production build.

- [ ] **Step 2: Check the generated site for forbidden claims and secrets**

Run: `rg -n "立即下载|App Store 下载|AI 对话|云同步|API_KEY|SECRET|TOKEN" apps/web/dist`

Expected: no matches.

Run: `git diff --check`

Expected: no whitespace errors in website-owned files.

- [ ] **Step 3: Start the local preview and inspect the five routes**

Run: `pnpm --filter @cave/web preview --host 127.0.0.1`

Expected: Astro prints a local URL and every route returns 200. Inspect keyboard order, focus visibility, narrow layout, 200% zoom, and reduced motion without editing unrelated App files.

- [ ] **Step 4: Commit verification fixes only if needed**

```bash
git add apps/web packages/content/src/index.ts packages/content/src/public-surface.test.ts package.json pnpm-lock.yaml
git commit -m "fix(web): resolve final verification findings"
```

- [ ] **Step 5: Hand off to the Cloudflare publishing plan**

Record the website commit, successful commands, and exact Pages build settings required by `docs/superpowers/plans/2026-08-28-cave-cloudflare-publishing.md`.

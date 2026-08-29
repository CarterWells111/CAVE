import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));

const activeDocuments = [
  "README.md",
  "docs/README.md",
  "docs/product/overview.md",
  "docs/product/current-limitations.md",
  "docs/architecture/overview.md",
  "docs/architecture/data-classification.md",
  "docs/architecture/threat-model.md",
  "docs/development/setup.md",
  "docs/development/verification.md",
  "docs/operations/email-authentication.md",
  "docs/content/source-registry.md"
] as const;

const publicIndexes = ["README.md", "docs/README.md"] as const;

function absolutePath(path: string) {
  return resolve(workspaceRoot, path);
}

function readDocument(path: string) {
  return readFileSync(absolutePath(path), "utf8");
}

function localMarkdownTargets(markdown: string) {
  return [...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu)]
    .map((match) => match[1]?.trim() ?? "")
    .map((target) => target.replace(/^<|>$/gu, ""))
    .map((target) => target.split("#", 1)[0] ?? "")
    .filter(
      (target) =>
        target.length > 0 &&
        !target.startsWith("http://") &&
        !target.startsWith("https://") &&
        !target.startsWith("mailto:")
    );
}

describe("public documentation contract", () => {
  it.each(activeDocuments)("keeps the active document %s", (path) => {
    expect(existsSync(absolutePath(path))).toBe(true);
  });

  it.each(publicIndexes)("keeps local links in %s resolvable", (path) => {
    expect(existsSync(absolutePath(path))).toBe(true);

    const markdown = readDocument(path);
    const missingTargets = localMarkdownTargets(markdown).filter(
      (target) => !existsSync(resolve(dirname(absolutePath(path)), target))
    );

    expect(missingTargets).toEqual([]);
  });

  it("describes the current product and privacy boundary without overclaiming AI", () => {
    const readme = readDocument("README.md");

    expect(readme).toContain("Expo SDK 54");
    expect(readme).toContain("六页旅程");
    expect(readme).toContain("当前移动端练习使用预设路径，不调用生成式 AI");
    expect(readme).toContain("手记登录只用于同一设备上的账号隔离");
    expect(readme).toContain("不提供云同步");
    expect(readme).toContain("corepack pnpm dev:mobile");
    expect(readme).toContain("corepack pnpm test");
    expect(readme).not.toContain("OpenAI-compatible HTTP model interface");
  });

  it("keeps internal execution language out of active documentation", () => {
    const activeText = activeDocuments
      .filter((path) => existsSync(absolutePath(path)))
      .map(readDocument)
      .join("\n");

    const forbiddenPatterns = [
      /开工入口/u,
      /施工蓝图/u,
      /主会话|子代理/u,
      /For agentic workers/iu,
      /\bPlan 0\d\b/iu,
      /C:\\Users\\/iu,
      /\.worktrees[/\\]/iu,
      /\bcodex\/[a-z0-9-]+/iu,
      /origin\/main@[a-f0-9]+/iu
    ];

    for (const pattern of forbiddenPatterns) {
      expect(activeText).not.toMatch(pattern);
    }
  });

  it("labels archived documents as historical and non-authoritative", () => {
    const archiveIndexPath = "docs/archive/README.md";
    expect(existsSync(absolutePath(archiveIndexPath))).toBe(true);

    const archiveIndex = readDocument(archiveIndexPath);
    expect(archiveIndex).toContain("历史资料");
    expect(archiveIndex).toContain("不作为当前产品范围、运行状态或发布结论的依据");
  });
});

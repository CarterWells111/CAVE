import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type ParsedYamlDocument = Readonly<{
  errors: unknown[];
  toJS(): unknown;
}>;

const rootRequire = createRequire(import.meta.url);
const vitestRequire = createRequire(rootRequire.resolve("vitest"));
const viteRequire = createRequire(vitestRequire.resolve("vite"));
const { parseAllDocuments } = viteRequire("yaml") as Readonly<{
  parseAllDocuments(source: string): ParsedYamlDocument[];
}>;

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const maestroFlows = readdirSync(resolve(root, ".maestro")).filter((name) => name.endsWith(".yaml")).map((name) => `.maestro/${name}`);

function parseMaestroDocuments(source: string) {
  const documents = parseAllDocuments(source);
  const errors = documents.flatMap((document) => document.errors);
  if (errors.length > 0) throw errors[0];
  return documents;
}

describe("Maestro release selectors", () => {
  it("uses current onboarding, return actions, and an existing deep-link route", () => {
    const flow = read(".maestro/core-flow.yaml");
    for (const stale of ["我已满 18 岁，开始探索", "先跳过", "继续看看我的在意", "记录这个感受，继续", "这次没有"]) expect(flow).not.toContain(stale);
    for (const current of ["我已年满 18 岁，继续", "我已了解，开始旅程", "进入行为地图", "返回练习入口"]) expect(flow).toContain(current);
    expect(read(".maestro/back-edit.yaml")).not.toContain("返回上一页");
    expect(read(".maestro/deep-links.yaml")).toContain("cave:///journey/body-knowledge");
    expect(read("apps/mobile/app/journey/body-knowledge.tsx")).toContain("JourneyRouteScreen");
  });
  it("parses every static flow as two valid YAML documents", () => {
    for (const path of maestroFlows) {
      const documents = parseMaestroDocuments(read(path));
      expect(documents).toHaveLength(2);
      expect(documents[0]?.toJS()).toMatchObject({ appId: "com.neijie.cave" });
      expect(Array.isArray(documents[1]?.toJS())).toBe(true);
    }
  });

  it("locks the history action to its current accessible label", () => {
    const flow = read(".maestro/back-edit.yaml");
    const screen = read("apps/mobile/src/features/shell/ui/ProfileScreen.tsx");

    expect(screen).toContain('testID="profile-review-open"');
    expect(flow).toContain('id: "profile-review-open"');
    expect(flow).not.toContain('tapOn: "回顾"');
  });

  it("locks the five-page completion flow and practice handoff to the four-tab main shell", () => {
    const flow = read(".maestro/core-flow.yaml");
    const nav = read("apps/mobile/src/features/shell/ui/LongTermTabBar.tsx");
    const destinations = read("apps/mobile/src/features/shell/ui/long-term-navigation.ts");
    const shell = read("apps/mobile/src/features/journey/ui/JourneyScreenShell.tsx");

    expect(nav).toContain("MAIN_TAB_DESTINATIONS");
    for (const label of ["首页", "回顾", "练习", "内界手记", "我的"]) {
      expect(destinations).toContain(`label: "${label}"`);
    }
    for (const label of ["首页", "练习", "内界手记", "我的"]) {
      expect(flow).toContain(`"${label}"`);
    }
    expect(flow).not.toContain('- assertVisible: "回顾"');
    for (const title of [
      "过夜期待与在意",
      "身体与安全知识",
      "行为地图与边界",
      "你随时可以改变主意",
      "我的沟通草稿"
    ]) {
      expect(shell).toContain(`"${title}"`);
      expect(flow).toContain(`assertVisible: "${title}"`);
    }
    expect(shell).not.toContain('"预设沟通练习"');
    expect(flow).toContain('assertVisible: "预设对话，不使用 AI"');
  });

  it("keeps delete-all as a local-state spec and delegates offline setup to external 07B", () => {
    const flow = read(".maestro/offline-delete.yaml");
    const settings = read("apps/mobile/src/features/shell/ui/SettingsScreen.tsx");

    expect(flow).not.toContain("setAirplaneMode");
    expect(flow).toContain("external 07B");
    expect(flow).toContain("name: Local delete-all clears release state");
    for (const label of ["删除全部本机数据", "确认删除全部本机数据", "本机数据已删除。"]) {
      expect(settings).toContain(label);
      expect(flow).toContain(label);
    }
  });
});

import { readFileSync } from "node:fs";
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
const maestroFlows = [
  ".maestro/core-flow.yaml",
  ".maestro/back-edit.yaml",
  ".maestro/offline-delete.yaml"
];

function parseMaestroDocuments(source: string) {
  const documents = parseAllDocuments(source);
  const errors = documents.flatMap((document) => document.errors);
  if (errors.length > 0) throw errors[0];
  return documents;
}

describe("Maestro release selectors", () => {
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
    const screen = read("apps/mobile/src/features/reviews/ui/ReviewHistoryScreen.tsx");

    expect(screen).toContain("`打开回顾：${review.title}`");
    expect(flow).toContain('text: "打开回顾：.*"');
    expect(flow).not.toContain('text: "打开回顾 .*"');
  });

  it("locks the seven-screen completion flow to the current four-tab shell", () => {
    const flow = read(".maestro/core-flow.yaml");
    const nav = read("apps/mobile/src/features/shell/ui/LongTermBottomNav.tsx");
    const shell = read("apps/mobile/src/features/journey/ui/JourneyScreenShell.tsx");

    for (const label of ["首页", "回顾", "练习", "卡片"]) {
      expect(nav).toContain(`label: "${label}"`);
      expect(flow).toContain(`"${label}"`);
    }
    for (const title of [
      "过夜期待与在意",
      "身体与安全知识",
      "行为地图与边界",
      "自我反思",
      "预设沟通练习",
      "私密准备与沟通草稿"
    ]) {
      expect(shell).toContain(`"${title}"`);
      expect(flow).toContain(`assertVisible: "${title}"`);
    }
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

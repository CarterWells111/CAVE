import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Maestro release selectors", () => {
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

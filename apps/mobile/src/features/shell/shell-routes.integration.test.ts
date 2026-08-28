declare const __dirname: string;

const { existsSync, readFileSync } = jest.requireActual<typeof import("node:fs")>("node:fs");
const { resolve } = jest.requireActual<typeof import("node:path")>("node:path");

function source(path: string) {
  return readFileSync(resolve(__dirname, "../../../app", path), "utf8");
}

test("ships exactly the four approved long-term tabs with a storage-readiness guard", () => {
  const layout = source("(tabs)/_layout.tsx");
  expect(layout.match(/<Tabs\.Screen/gu)).toHaveLength(4);
  for (const label of ["首页", "回顾", "练习", "我的"]) expect(layout).toContain(`title: "${label}"`);
  expect(layout).toContain("ShellRouteGate");
  expect(layout).toContain("LongTermTabBar");
  expect(layout).toContain('type: "tabPress"');
  expect(layout).toContain("canPreventDefault: true");
  expect(layout).not.toMatch(/name="cards"|课程|记录/u);
});

test("loads long-term lists through metadata-only repository projections", () => {
  expect(source("(tabs)/index.tsx")).toContain("cards.listMetadata()");
  expect(source("(tabs)/profile.tsx")).toContain("cards.listMetadata()");
  expect(source("(tabs)/profile.tsx")).toContain("reviewHistory.listMetadata()");
  expect(source("(tabs)/index.tsx")).not.toContain("cards.list()");
  expect(source("(tabs)/profile.tsx")).not.toContain("cards.list()");
  expect(source("(tabs)/reviews.tsx")).not.toContain("reviewHistory.listMetadata()");
});

test("keeps settings outside tabs and available before journey completion", () => {
  expect(source("(tabs)/index.tsx")).toContain('router.push("/settings")');
  expect(source("settings/_layout.tsx")).not.toContain("ShellRouteGate");
  expect(source("settings/index.tsx")).toContain("runtime.deleteAllData()");
  expect(source("journey/welcome.tsx")).toContain('router.push("/settings")');
  expect(source("../src/features/shell/ui/SettingsScreen.tsx")).toContain("登录与云端同步（尚未开放）");
});

test("keeps the long-term navigation available during later full reviews", () => {
  expect(source("journey/_layout.tsx")).toContain("JourneyLongTermNav");
  const nav = source("../src/features/shell/ui/LongTermBottomNav.tsx");
  const destinations = source("../src/features/shell/ui/long-term-navigation.ts");
  expect(nav).toContain("LONG_TERM_DESTINATIONS.map");
  for (const label of ["首页", "回顾", "练习", "我的"]) expect(destinations).toContain(`label: "${label}"`);
  expect(nav).toContain('accessibilityRole="tab"');
});

test("classifies and resumes the unfinished initial journey without replacing it", () => {
  for (const route of ["(tabs)/index.tsx", "(tabs)/reviews.tsx"]) {
    expect(source(route)).toContain("classifyActiveJourney");
    expect(source(route)).toContain("getResumePath");
  }
});

test("opens standalone practice and saved-card details without journey prerequisites", () => {
  expect(source("(tabs)/practice.tsx")).toContain('pathname: "/practice/session"');
  expect(source("(tabs)/practice.tsx")).toContain("params: { scenario: id }");
  expect(source("(tabs)/index.tsx")).toContain('router.push("/practice/session")');
  expect(source("practice/session.tsx")).toContain('context="standalone"');
  expect(source("practice/session.tsx")).toContain("parseStandalonePracticeScenario");
  expect(source("practice/session.tsx")).toContain("openJourneySources");
  expect(source("(tabs)/reviews.tsx")).toContain("`/reviews/topic/${id}`");
  expect(source("reviews/topic/[id].tsx")).toContain('storageMode="session-only"');
  expect(source("(tabs)/profile.tsx")).toContain("`/cards/${id}`");
  expect(source("cards/[id].tsx")).toContain("runtime.cards.load(id)");
  expect(source("cards/[id].tsx")).toContain('router.replace("/(tabs)/profile")');
  expect(source("reviews/[id].tsx")).toContain('router.replace("/(tabs)/profile")');
  expect(existsSync(resolve(__dirname, "../../../app/(tabs)/cards.tsx"))).toBe(false);
  expect(existsSync(resolve(__dirname, "ui/CardsHubScreen.tsx"))).toBe(false);
});

test("edits every saved-card section and applies only explicit updates", () => {
  const route = source("cards/[id].tsx");
  expect(route).toContain("buildEditableSavedCardSections(record)");
  expect(route).toContain("applySavedCardSectionUpdates(record, updates)");
  expect(route).toContain("sections={editableSections}");
  expect(route).toContain("setRecord(updatedRecord)");
});

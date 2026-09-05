declare const __dirname: string;

const { existsSync, readFileSync } = jest.requireActual<typeof import("node:fs")>("node:fs");
const { resolve } = jest.requireActual<typeof import("node:path")>("node:path");

function source(path: string) {
  return readFileSync(resolve(__dirname, "../../../app", path), "utf8");
}

test("registers all five tab routes while the main tab bar selects its visible destinations", () => {
  const layout = source("(tabs)/_layout.tsx");
  expect(layout.match(/<Tabs\.Screen/gu)).toHaveLength(5);
  for (const label of ["首页", "回顾", "练习", "内界手记", "我的"]) expect(layout).toContain(`title: "${label}"`);
  expect(layout).not.toContain("ShellRouteGate");
  expect(layout).toContain("LongTermTabBar");
  expect(layout).toContain('type: "tabPress"');
  expect(layout).toContain("canPreventDefault: true");
  expect(layout).not.toMatch(/name="cards"|课程|记录/u);
});

test("keeps session-only routes public and protects only private detail routes", () => {
  expect(source("practice/_layout.tsx")).not.toContain("ShellRouteGate");
  expect(source("reviews/_layout.tsx")).not.toContain("ShellRouteGate");
  expect(source("cards/_layout.tsx")).toContain("ShellRouteGate");
  expect(source("reviews/[id].tsx")).toContain("ShellRouteGate");
  expect(source("practice/session.tsx")).toContain('context="standalone"');
  expect(source("reviews/topic/[id].tsx")).toContain('storageMode="session-only"');
  const journalTab = source("(tabs)/journal.tsx");
  expect(journalTab).toContain("ShellRouteGate");
  expect(journalTab).toContain("JournalRouteGate");
  expect(journalTab).toContain("JournalListScreen");
  expect(existsSync(resolve(__dirname, "../../../app/journal/index.tsx"))).toBe(false);
});

test("keeps metadata lists in My and avoids repository reads on the map", () => {
  expect(source("(tabs)/index.tsx")).not.toContain("cards.listMetadata()");
  expect(source("(tabs)/profile.tsx")).toContain("cards.listMetadata()");
  expect(source("(tabs)/profile.tsx")).toContain("reviewHistory.listMetadata()");
  expect(source("(tabs)/index.tsx")).not.toContain("cards.list()");
  expect(source("(tabs)/profile.tsx")).not.toContain("cards.list()");
  expect(source("(tabs)/reviews.tsx")).not.toContain("reviewHistory.listMetadata()");
});

test("keeps settings outside tabs and available before journey completion", () => {
  expect(source("(tabs)/index.tsx")).toContain('router.push("/settings")');
  expect(source("settings/_layout.tsx")).not.toContain("ShellRouteGate");
  expect(source("settings/index.tsx")).toContain("useOptionalJourneyRuntime");
  expect(source("settings/index.tsx")).not.toContain('<Redirect href="/journey/welcome"');
  expect(source("settings/index.tsx")).toContain("runtime.deleteAllData()");
  expect(source("journey/welcome.tsx")).toContain('router.push("/settings")');
  expect(source("../src/features/shell/ui/SettingsScreen.tsx")).toContain("邮箱登录（不含同步）");
  expect(source("../src/features/shell/ui/SettingsScreen.tsx")).toContain("登录不会上传日记、沟通卡、回顾或亲密内容");
  expect(source("../src/features/shell/ui/SettingsScreen.tsx")).toContain("使用内界手记必须登录");
});

test("keeps the long-term navigation available during later full reviews", () => {
  expect(source("journey/_layout.tsx")).toContain("JourneyLongTermNav");
  const nav = source("../src/features/shell/ui/LongTermBottomNav.tsx");
  const destinations = source("../src/features/shell/ui/long-term-navigation.ts");
  expect(nav).toContain("destinations.map");
  for (const label of ["首页", "回顾", "练习", "内界手记", "我的"]) expect(destinations).toContain(`label: "${label}"`);
  expect(nav).toContain('accessibilityRole="tab"');
});

test("classifies and resumes the unfinished initial journey without replacing it", () => {
  for (const route of ["(tabs)/index.tsx", "(tabs)/reviews.tsx"]) {
    expect(source(route)).not.toContain("replaceActiveReview");
  }
  expect(source("(tabs)/index.tsx")).toContain("prepareFirstOvernight");
  expect(source("(tabs)/reviews.tsx")).toContain("classifyActiveJourney");
  expect(source("(tabs)/reviews.tsx")).toContain("scenarioResumeHref");
});

test("opens standalone practice and saved-card details without journey prerequisites", () => {
  expect(source("(tabs)/practice.tsx")).toContain('pathname: "/practice/session"');
  expect(source("(tabs)/practice.tsx")).toContain("params: { scenario: id }");
  expect(source("(tabs)/index.tsx")).toContain('pathname: "/explore/[journeyId]"');
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

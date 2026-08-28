declare const __dirname: string;

const { readFileSync } = jest.requireActual<typeof import("node:fs")>("node:fs");
const { resolve } = jest.requireActual<typeof import("node:path")>("node:path");

function source(path: string) {
  return readFileSync(resolve(__dirname, "../../../app", path), "utf8");
}

test("ships exactly the four approved long-term tabs behind the completion guard", () => {
  const layout = source("(tabs)/_layout.tsx");
  expect(layout.match(/<Tabs\.Screen/gu)).toHaveLength(4);
  for (const label of ["首页", "回顾", "练习", "草稿"]) expect(layout).toContain(`title: "${label}"`);
  expect(layout).toContain("ShellRouteGate");
  expect(layout).not.toMatch(/我的|课程|记录/u);
});

test("loads long-term lists through metadata-only repository projections", () => {
  expect(source("(tabs)/index.tsx")).toContain("cards.listMetadata()");
  expect(source("(tabs)/cards.tsx")).toContain("cards.listMetadata()");
  expect(source("(tabs)/index.tsx")).not.toContain("cards.list()");
  expect(source("(tabs)/cards.tsx")).not.toContain("cards.list()");
});

test("keeps settings outside tabs and available before journey completion", () => {
  expect(source("(tabs)/index.tsx")).toContain('router.push("/settings")');
  expect(source("settings/_layout.tsx")).not.toContain("ShellRouteGate");
  expect(source("settings/index.tsx")).toContain("runtime.deleteAllData()");
  expect(source("journey/welcome.tsx")).toContain('router.push("/settings")');
  expect(source("../src/features/shell/ui/CardsHubScreen.tsx")).not.toMatch(/云端|后续版本/u);
});

test("keeps the long-term navigation available during later full reviews", () => {
  expect(source("journey/_layout.tsx")).toContain("JourneyLongTermNav");
  const nav = source("../src/features/shell/ui/LongTermBottomNav.tsx");
  for (const label of ["首页", "回顾", "练习", "草稿"]) expect(nav).toContain(`label: "${label}"`);
  expect(nav).toContain('accessibilityRole="tab"');
});

test("opens standalone practice and saved-card details without journey prerequisites", () => {
  expect(source("(tabs)/practice.tsx")).toContain('router.push("/practice/session")');
  expect(source("(tabs)/index.tsx")).toContain('router.push("/practice/session")');
  expect(source("practice/session.tsx")).toContain('context="standalone"');
  expect(source("(tabs)/reviews.tsx")).toContain("`/reviews/topic/${id}`");
  expect(source("(tabs)/cards.tsx")).toContain("`/cards/${id}`");
  expect(source("cards/[id].tsx")).toContain("runtime.cards.load(id)");
});

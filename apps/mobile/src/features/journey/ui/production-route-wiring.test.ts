declare const __dirname: string;

const { readFileSync } = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
}>("node:fs");
const { resolve } = jest.requireActual<{
  resolve(...paths: string[]): string;
}>("node:path");

const routeDirectory = resolve(__dirname, "../../../../app/journey");
const canonicalRoutes = [
  "welcome.tsx",
  "overnight.tsx",
  "body-knowledge.tsx",
  "behavior-map.tsx",
  "reflection.tsx",
  "preset-practice.tsx",
  "final-preparation.tsx"
];
const legacyAliases = ["behavior-attitudes.tsx", "checklist.tsx", "communication-card.tsx"];

function routeSource(name: string) {
  return readFileSync(resolve(routeDirectory, name), "utf8");
}

test("root layout mounts one runtime composition provider shared by journey and shell routes", () => {
  const layout = readFileSync(resolve(routeDirectory, "../_layout.tsx"), "utf8");
  const journeyLayout = routeSource("_layout.tsx");

  expect(layout).toContain("JourneyRuntimeProvider");
  expect(layout).toContain("<JourneyRuntimeProvider");
  expect(journeyLayout).not.toContain("JourneyRuntimeProvider");
  expect(journeyLayout).toContain("JourneyLongTermNav");
});

test("exactly seven production routes consume runtime state without no-op callbacks", () => {
  expect(canonicalRoutes).toHaveLength(7);
  for (const name of canonicalRoutes) {
    const source = routeSource(name);
    expect(source).toMatch(/useJourneyRuntime|JourneyRouteScreen/u);
    expect(source).not.toMatch(/=>\s*undefined|=>\s*\{\s*\}/u);
  }
});

test("exactly three legacy route modules are redirect-only aliases", () => {
  expect(legacyAliases).toHaveLength(3);
  for (const name of legacyAliases) {
    const source = routeSource(name);
    expect(source).toContain("<Redirect");
    expect(source).not.toMatch(/useJourneyRuntime|JourneyRouteScreen/u);
  }
});

test("production route actions return asynchronous work to Promise-aware UI controls", () => {
  const canonicalSources = canonicalRoutes.map(routeSource).join("\n");
  const routeScreen = readFileSync(resolve(__dirname, "JourneyRouteScreen.tsx"), "utf8");

  expect(`${canonicalSources}\n${routeScreen}`).not.toMatch(
    /\bvoid\s+(?:runAndRefresh|goTo|controller\.[A-Za-z]+)\s*\(/u
  );
  expect(`${canonicalSources}\n${routeScreen}`).not.toMatch(
    /=>\s*\{\s*(?:runAndRefresh|goTo|controller\.[A-Za-z]+|runtime\.restart)\s*\(/u
  );
  expect(canonicalSources).not.toMatch(/<Pressable\b/u);
  expect(routeSource("body-knowledge.tsx")).not.toContain("JourneyContinueButton");
  expect(routeSource("behavior-map.tsx")).not.toContain("JourneyContinueButton");
});

test("production routes do not ship the reduced-scope hard-coded journey outputs", () => {
  const sources = canonicalRoutes.map(routeSource).join("\n");

  expect(sources).not.toContain("resumeAvailable={false}");
  expect(sources).not.toContain("items={[]}");
  expect(sources).not.toContain("pointTotal={0}");
  expect(sources).not.toContain("draft-card.intentions");
});

test("the Expo Go runtime selector stays free of secure native module imports", () => {
  const runtime = readFileSync(
    resolve(__dirname, "../runtime/journey-runtime.ts"),
    "utf8"
  );

  expect(runtime).not.toMatch(/from ["']expo-(?:sqlite|secure-store|file-system)["']/u);
});

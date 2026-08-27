declare const __dirname: string;

const { readFileSync, readdirSync } = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
  readdirSync(path: string): string[];
}>("node:fs");
const { resolve } = jest.requireActual<{
  resolve(...paths: string[]): string;
}>("node:path");

const routeDirectory = resolve(__dirname, "../../../../app/journey");

function routeSource(name: string) {
  return readFileSync(resolve(routeDirectory, name), "utf8");
}

test("journey layout mounts one runtime composition provider", () => {
  const layout = routeSource("_layout.tsx");

  expect(layout).toContain("JourneyRuntimeProvider");
  expect(layout).toContain("<JourneyRuntimeProvider");
});

test("all eight production routes consume runtime state without no-op callbacks", () => {
  const canonicalRoutes = readdirSync(routeDirectory)
    .filter((name) => name.endsWith(".tsx"))
    .filter((name) => !["_layout.tsx", "preface.tsx", "underage-exit.tsx"].includes(name));

  expect(canonicalRoutes).toHaveLength(8);
  for (const name of canonicalRoutes) {
    const source = routeSource(name);
    expect(source).toMatch(/useJourneyRuntime|JourneyRouteScreen/u);
    expect(source).not.toMatch(/=>\s*undefined|=>\s*\{\s*\}/u);
  }
});

test("production routes do not ship the reduced-scope hard-coded journey outputs", () => {
  const sources = readdirSync(routeDirectory)
    .filter((name) => name.endsWith(".tsx"))
    .map(routeSource)
    .join("\n");

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

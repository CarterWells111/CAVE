declare const __dirname: string;

const { readFileSync, readdirSync } = jest.requireActual<typeof import("node:fs")>("node:fs");
const { resolve } = jest.requireActual<{
  resolve(...paths: string[]): string;
}>("node:path");

test("journey routes stay thin and contain no storage, network, model or SQL imports", () => {
  const routeDirectory = resolve(__dirname, "../../../../app/journey");
  const sources = readdirSync(routeDirectory)
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => readFileSync(resolve(routeDirectory, name), "utf8"))
    .join("\n");

  const forbidden = [
    "core/storage",
    "core/network",
    ["Gateway", "Client"].join(""),
    ["Model", "Provider"].join(""),
    "SELECT\\s",
    "INSERT\\s",
    ["fe", "tch\\("].join("")
  ];
  expect(sources).not.toMatch(new RegExp(forbidden.join("|"), "u"));
});

test("the root entry routes first-run and completed users from persisted shell state", () => {
  const indexSource = readFileSync(
    resolve(__dirname, "../../../../app/index.tsx"),
    "utf8"
  );

  expect(indexSource).toContain("shellState.load()");
  expect(indexSource).toContain("resolveShellLaunchPath");
  expect(indexSource).not.toContain("<HealthScreen");
  expect(indexSource).not.toContain("<Redirect");
});

test("exactly seven canonical routes compose their matching page components", () => {
  const routeDirectory = resolve(__dirname, "../../../../app/journey");
  const expected = {
    welcome: "WelcomePage",
    overnight: "OvernightPage",
    "body-knowledge": "BodyKnowledgePage",
    "behavior-map": "BehaviorMapPage",
    reflection: "ReflectionPage",
    "preset-practice": "PresetPracticePage",
    "final-preparation": "FinalPreparationPage"
  };
  expect(Object.keys(expected)).toHaveLength(7);
  for (const [route, component] of Object.entries(expected)) {
    expect(readFileSync(resolve(routeDirectory, `${route}.tsx`), "utf8")).toContain(`<${component}`);
  }
});

test("the Expo Router app directory contains no test or spec modules", () => {
  const appDirectory = resolve(__dirname, "../../../../app");
  const testModules = readdirSync(appDirectory, { recursive: true })
    .map((name) => name.toString())
    .filter((name) => /(?:^|[\\/]).+\.(?:test|spec)\.[jt]sx?$/u.test(name));

  expect(testModules).toEqual([]);
});

test("exactly three legacy aliases redirect to canonical routes", () => {
  const routeDirectory = resolve(__dirname, "../../../../app/journey");
  const aliases = {
    "behavior-attitudes": "/journey/behavior-map",
    checklist: "/journey/final-preparation",
    "communication-card": "/journey/final-preparation"
  };

  expect(Object.keys(aliases)).toHaveLength(3);
  for (const [route, destination] of Object.entries(aliases)) {
    const source = readFileSync(resolve(routeDirectory, `${route}.tsx`), "utf8");
    expect(source).toContain("<Redirect");
    expect(source).toContain(`href="${destination}"`);
    expect(source).not.toContain("<JourneyRouteScreen");
  }
});

test("the production route inventory contains only seven canonical routes and three legacy aliases", () => {
  const routeDirectory = resolve(__dirname, "../../../../app/journey");
  const auxiliaryModules = ["_layout.tsx", "preface.tsx", "underage-exit.tsx"];
  const productionRoutes = readdirSync(routeDirectory)
    .filter((name) => name.endsWith(".tsx"))
    .filter((name) => !auxiliaryModules.includes(name))
    .sort();

  expect(productionRoutes).toEqual([
    "behavior-attitudes.tsx",
    "behavior-map.tsx",
    "body-knowledge.tsx",
    "checklist.tsx",
    "communication-card.tsx",
    "final-preparation.tsx",
    "overnight.tsx",
    "preset-practice.tsx",
    "reflection.tsx",
    "welcome.tsx"
  ]);
});

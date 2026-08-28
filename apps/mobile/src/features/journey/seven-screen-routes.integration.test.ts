declare const __dirname: string;

const { readFileSync, readdirSync } = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
  readdirSync(path: string): string[];
}>("node:fs");
const { resolve } = jest.requireActual<{
  resolve(...paths: string[]): string;
}>("node:path");

const routeDirectory = resolve(__dirname, "../../../app/journey");

function routeSource(name: string) {
  return readFileSync(resolve(routeDirectory, name), "utf8");
}

test("ships exactly the six canonical content route modules", () => {
  const canonical = [
    "body-knowledge",
    "overnight",
    "behavior-map",
    "reflection",
    "preset-practice",
    "final-preparation"
  ];
  const files = readdirSync(routeDirectory);

  for (const pageId of canonical) {
    expect(files).toContain(`${pageId}.tsx`);
    expect(routeSource(`${pageId}.tsx`)).toContain(`pageId="${pageId}"`);
  }
});

test.each([
  ["behavior-attitudes", "behavior-map"],
  ["checklist", "final-preparation"],
  ["communication-card", "final-preparation"]
] as const)("redirects the legacy %s route to %s", (legacy, canonical) => {
  const source = routeSource(`${legacy}.tsx`);

  expect(source).toContain("<Redirect");
  expect(source).toContain(`href="/journey/${canonical}"`);
  expect(source).not.toContain("JourneyRouteScreen");
});

test("connects every canonical continue action without an eighth page or dead-end alias", () => {
  expect(routeSource("body-knowledge.tsx")).toContain('goTo("overnight")');
  expect(routeSource("body-knowledge.tsx")).not.toContain('/journey/adult-gate');
  expect(routeSource("preset-practice.tsx")).toContain('goTo("final-preparation")');

  const canonicalSources = [
    "welcome.tsx",
    "overnight.tsx",
    "body-knowledge.tsx",
    "behavior-map.tsx",
    "reflection.tsx",
    "preset-practice.tsx",
    "final-preparation.tsx"
  ].map(routeSource).join("\n");

  expect(canonicalSources).not.toMatch(/pageId="(?:checklist|communication-card|behavior-attitudes)"/u);
  expect(canonicalSources).not.toMatch(/goTo\("(?:checklist|communication-card|behavior-attitudes)"\)/u);
  expect(canonicalSources).not.toMatch(/\b8\s*\/\s*8\b|\/8\b|共\s*8\s*页/u);
});

test("opens the public landing before consulting private shell state", () => {
  const entry = readFileSync(resolve(routeDirectory, "../index.tsx"), "utf8");

  expect(entry).toContain('router.replace("/journey/welcome")');
  expect(entry).not.toContain("resolveShellLaunchPath");
  expect(entry).not.toContain("shellState.load()");
  expect(entry).not.toContain("八屏");
});

declare const __dirname: string;

const { readFileSync, readdirSync } = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
  readdirSync(path: string): string[];
}>("node:fs");
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

test("an in-progress journey does not replace the working app entry route", () => {
  const indexSource = readFileSync(
    resolve(__dirname, "../../../../app/index.tsx"),
    "utf8"
  );

  expect(indexSource).toContain("<HealthScreen");
  expect(indexSource).not.toContain("<Redirect");
  expect(indexSource).not.toContain("/journey/");
});

test("each canonical route composes its matching basic page component", () => {
  const routeDirectory = resolve(__dirname, "../../../../app/journey");
  const expected = {
    welcome: "WelcomePage",
    overnight: "OvernightPage",
    "body-knowledge": "BodyKnowledgePage",
    "behavior-attitudes": "BehaviorAttitudesPage",
    reflection: "ReflectionPage",
    "preset-practice": "PresetPracticePage",
    checklist: "ChecklistPage",
    "communication-card": "CommunicationCardPage"
  };
  for (const [route, component] of Object.entries(expected)) {
    expect(readFileSync(resolve(routeDirectory, `${route}.tsx`), "utf8")).toContain(`<${component}`);
  }
});

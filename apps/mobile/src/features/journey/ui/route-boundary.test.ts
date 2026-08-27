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

  expect(sources).not.toMatch(/core\/storage|core\/network|GatewayClient|ModelProvider|SELECT\s|INSERT\s|fetch\(/u);
});

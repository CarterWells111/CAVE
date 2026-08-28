declare const __dirname: string;

const { readFileSync } = jest.requireActual<typeof import("node:fs")>("node:fs");
const { resolve } = jest.requireActual<typeof import("node:path")>("node:path");

function source(path: string) {
  return readFileSync(resolve(__dirname, "../../../app", path), "utf8");
}

test("owns one journey and shell runtime above first-run and long-term routes", () => {
  const rootLayout = source("_layout.tsx");
  const journeyLayout = source("journey/_layout.tsx");

  expect(rootLayout).toContain("JourneyRuntimeProvider");
  expect(rootLayout).toContain("createExpoJourneyRuntime");
  expect(journeyLayout).not.toContain("JourneyRuntimeProvider");
  expect(journeyLayout).not.toContain("createExpoJourneyRuntime");
});

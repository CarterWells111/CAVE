import {
  parseStandalonePracticeScenario,
  standaloneScenarioIntent,
} from "./standalone-practice-route";

test.each([
  ["pause", "pause"],
  ["adjust", "adjust"],
  [undefined, undefined],
  ["unknown", undefined],
  [["pause", "adjust"], undefined],
] as const)("parses standalone scenario route value %p", (input, expected) => {
  expect(parseStandalonePracticeScenario(input)).toBe(expected);
});

test("maps approved scenarios to deterministic practice intents", () => {
  expect(standaloneScenarioIntent("pause")).toBe("pause-and-decide");
  expect(standaloneScenarioIntent("adjust")).toBe("adjust-touch");
  expect(standaloneScenarioIntent(undefined)).toBeUndefined();
});

import {
  parseStandalonePracticePhrase,
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

test.each([
  ["  先停一下，我现在不想继续。  ", "先停一下，我现在不想继续。"],
  ["停".repeat(160), "停".repeat(160)],
  ["", undefined],
  [["先停一下。"], undefined],
  ["停".repeat(161), undefined],
] as const)("parses a bounded contextual phrase %p", (input, expected) => {
  expect(parseStandalonePracticePhrase(input)).toBe(expected);
});

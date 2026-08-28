import type { PracticeIntent } from "../domain/practice-types";

export type StandalonePracticeScenario = "pause" | "adjust";

export function parseStandalonePracticeScenario(
  value: string | readonly string[] | undefined,
): StandalonePracticeScenario | undefined {
  return value === "pause" || value === "adjust" ? value : undefined;
}

export function standaloneScenarioIntent(
  scenario: StandalonePracticeScenario | undefined,
): PracticeIntent | undefined {
  if (scenario === "pause") return "pause-and-decide";
  if (scenario === "adjust") return "adjust-touch";
  return undefined;
}

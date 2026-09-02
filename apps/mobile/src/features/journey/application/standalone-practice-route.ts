import type { PracticeIntent } from "../domain/practice-types";

export type StandalonePracticeScenario = "pause" | "adjust";
export const MAX_STANDALONE_PRACTICE_PHRASE_LENGTH = 160;

export function parseStandalonePracticePhrase(
  value: string | readonly string[] | undefined,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const phrase = value.trim();
  return phrase.length > 0 && phrase.length <= MAX_STANDALONE_PRACTICE_PHRASE_LENGTH
    ? phrase
    : undefined;
}

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

import type { Href } from "expo-router";

import { getResumePath } from "../../journey/application/journey-navigation";
import type { JourneyDraft } from "../../journey/domain/types";
import type { JourneyRuntimeContextValue } from "../../journey/runtime/JourneyRuntimeProvider";

export type JourneyEntry = "map" | "first-overnight";

export function resolveJourneyEntry(value: unknown): JourneyEntry {
  return value === "first-overnight" ? "first-overnight" : "map";
}

export function onboardingHref(
  pathname: "/journey/welcome" | "/journey/adult-gate" | "/journey/preface",
  entry: JourneyEntry,
): Href {
  return entry === "map" ? pathname : { pathname, params: { entry } };
}

export function hasJourneyOnboarding(draft: JourneyDraft | null | undefined): boolean {
  return draft?.ageConfirmed === true && draft.addressPreference !== null && draft.prefaceRead;
}

export function scenarioResumeHref(draft: JourneyDraft | null): Href {
  return hasJourneyOnboarding(draft)
    ? getResumePath(draft)
    : onboardingHref("/journey/preface", "first-overnight");
}

// Called only by an explicit scenario press. Samples and map access never write.
export async function prepareFirstOvernight(
  runtime: Pick<JourneyRuntimeContextValue, "service" | "runAndRefresh">,
): Promise<Href> {
  if (runtime.service.getSnapshot() === null) {
    await runtime.runAndRefresh(() => runtime.service.confirmAdult());
  }
  return scenarioResumeHref(runtime.service.getSnapshot());
}

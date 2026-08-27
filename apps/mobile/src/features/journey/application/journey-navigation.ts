import type { JourneyDraft, JourneyPageId } from "../domain/types";

export const JOURNEY_PAGE_IDS = [
  "welcome",
  "overnight",
  "body-knowledge",
  "behavior-attitudes",
  "reflection",
  "preset-practice",
  "checklist",
  "communication-card"
] as const satisfies readonly JourneyPageId[];

export const JOURNEY_ROUTE_MANIFEST = [
  ...JOURNEY_PAGE_IDS,
  "underage-exit",
  "preface"
] as const;

export function canAccessJourneyPage(draft: JourneyDraft | null, page: JourneyPageId) {
  return page === "welcome" || draft?.ageConfirmed === true;
}

export function getAdjacentJourneyPage(page: JourneyPageId, direction: -1 | 1): JourneyPageId | null {
  const index = JOURNEY_PAGE_IDS.indexOf(page);
  return JOURNEY_PAGE_IDS[index + direction] ?? null;
}

export function getResumePath(draft: JourneyDraft | null): `/journey/${JourneyPageId}` {
  return `/journey/${draft?.ageConfirmed === true ? draft.currentPage : "welcome"}`;
}

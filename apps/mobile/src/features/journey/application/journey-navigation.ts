import {
  JOURNEY_PAGE_IDS as DOMAIN_JOURNEY_PAGE_IDS,
  type JourneyDraft,
  type JourneyPageId
} from "../domain/types";

export const JOURNEY_PAGE_IDS = DOMAIN_JOURNEY_PAGE_IDS;

export const LEGACY_JOURNEY_PAGE_ALIASES = {
  "behavior-attitudes": "behavior-map",
  checklist: "final-preparation",
  "communication-card": "final-preparation"
} as const satisfies Readonly<Record<string, JourneyPageId>>;

export const JOURNEY_ROUTE_MANIFEST = [
  ...JOURNEY_PAGE_IDS,
  "underage-exit",
  "preface"
] as const;

export function canAccessJourneyPage(draft: JourneyDraft | null, page: JourneyPageId) {
  return page === "welcome" || draft?.ageConfirmed === true;
}

export function resolveJourneyPageAlias(page: string): JourneyPageId | null {
  if ((JOURNEY_PAGE_IDS as readonly string[]).includes(page)) return page as JourneyPageId;
  return LEGACY_JOURNEY_PAGE_ALIASES[page as keyof typeof LEGACY_JOURNEY_PAGE_ALIASES] ?? null;
}

export function getAdjacentJourneyPage(page: JourneyPageId, direction: -1 | 1): JourneyPageId | null {
  const index = JOURNEY_PAGE_IDS.indexOf(page);
  return JOURNEY_PAGE_IDS[index + direction] ?? null;
}

export function getResumePath(draft: JourneyDraft | null): `/journey/${JourneyPageId}` {
  return `/journey/${draft?.ageConfirmed === true ? draft.currentPage : "welcome"}`;
}

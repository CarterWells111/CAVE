import {
  JOURNEY_PAGE_IDS as DOMAIN_JOURNEY_PAGE_IDS,
  type JourneyDraft,
  type JourneyPageId
} from "../domain/types";
import {
  BEHAVIOR_MAP_COMPLETE_POINT_EVENT_KEY,
  OVERNIGHT_COMPLETE_POINT_EVENT_KEY,
} from "./journey-progress-markers";

export const JOURNEY_PAGE_IDS = DOMAIN_JOURNEY_PAGE_IDS;
export type JourneyRoutePath = `/journey/${JourneyPageId}` | "/journey/welcome";

export const LEGACY_JOURNEY_PAGE_ALIASES = {
  "behavior-attitudes": "behavior-map",
  checklist: "final-preparation",
  "communication-card": "final-preparation"
} as const satisfies Readonly<Record<string, JourneyPageId>>;

export const JOURNEY_ROUTE_MANIFEST = [
  "welcome",
  "preface",
  "adult-gate",
  ...JOURNEY_PAGE_IDS
] as const;

export function shouldEnableJourneyNativeBackGesture(pathname: string, locked: boolean) {
  if (locked) return false;
  return !JOURNEY_PAGE_IDS.some((page) => pathname === `/journey/${page}`);
}

const REQUIRED_KNOWLEDGE_CARD_IDS = [
  "draft-knowledge-body-signals",
  "draft-knowledge-consent",
  "draft-knowledge-health",
] as const;

const REQUIRED_BASE_BEHAVIOR_IDS = [
  "behavior-hug",
  "draft-kissing",
  "behavior-same-bed",
  "behavior-my-nudity",
  "behavior-partner-nudity",
  "behavior-over-clothes-touch",
  "behavior-direct-touch",
] as const;

export function canAccessJourneyPage(draft: JourneyDraft | null, page: JourneyPageId) {
  if (draft?.ageConfirmed !== true) return false;
  const onboardingCompleted = draft.addressPreference !== null && draft.prefaceRead;
  if (page === "body-knowledge") return onboardingCompleted;
  if (onboardingCompleted && draft.currentPage === page) return true;

  const knowledgeCompleted = onboardingCompleted
    && REQUIRED_KNOWLEDGE_CARD_IDS.every((id) => draft.readKnowledgeCardIds.includes(id));
  if (page === "overnight") return knowledgeCompleted && draft.ageConfirmed;

  const overnightCompleted = knowledgeCompleted
    && draft.ageConfirmed
    && draft.pointEventKeys.includes(OVERNIGHT_COMPLETE_POINT_EVENT_KEY);
  if (page === "behavior-map") return overnightCompleted;

  const legacyBehaviorMapCompleted = draft.explicitContentConsent !== null
    && REQUIRED_BASE_BEHAVIOR_IDS.every((id) => draft.behaviorAttitudes[id] !== undefined);
  const behaviorMapCompleted = overnightCompleted
    && (
      draft.pointEventKeys.includes(BEHAVIOR_MAP_COMPLETE_POINT_EVENT_KEY)
      || legacyBehaviorMapCompleted
    );
  if (page === "reflection") return behaviorMapCompleted;

  const reflectionCompleted = behaviorMapCompleted
    && (draft.journal.saveChoice === "not-saved" || draft.journal.savedAt !== undefined);
  if (page === "preset-practice") return reflectionCompleted;

  return reflectionCompleted && draft.practice.completed;
}

export function resolveJourneyPageAlias(page: string): JourneyPageId | null {
  if ((JOURNEY_PAGE_IDS as readonly string[]).includes(page)) return page as JourneyPageId;
  return LEGACY_JOURNEY_PAGE_ALIASES[page as keyof typeof LEGACY_JOURNEY_PAGE_ALIASES] ?? null;
}

export function getAdjacentJourneyPage(page: JourneyPageId, direction: -1 | 1): JourneyPageId | null {
  const index = JOURNEY_PAGE_IDS.indexOf(page);
  return JOURNEY_PAGE_IDS[index + direction] ?? null;
}

export function getResumePath(draft: JourneyDraft | null): JourneyRoutePath {
  if (draft === null) return "/journey/welcome";
  const currentIndex = JOURNEY_PAGE_IDS.indexOf(draft.currentPage);
  for (let index = currentIndex; index >= 0; index -= 1) {
    const page = JOURNEY_PAGE_IDS[index];
    if (page !== undefined && canAccessJourneyPage(draft, page)) return `/journey/${page}`;
  }
  return "/journey/welcome";
}

import { createJourneyDraft } from "../domain/types";
import {
  JOURNEY_PAGE_IDS,
  JOURNEY_ROUTE_MANIFEST,
  resolveJourneyPageAlias,
  canAccessJourneyPage,
  getAdjacentJourneyPage,
  getResumePath
} from "./journey-navigation";

test("freezes the seven canonical pages plus exit and overlay routes", () => {
  expect(JOURNEY_PAGE_IDS).toEqual([
    "welcome",
    "overnight",
    "body-knowledge",
    "behavior-map",
    "reflection",
    "preset-practice",
    "final-preparation"
  ]);
  expect(JOURNEY_ROUTE_MANIFEST).toEqual([
    ...JOURNEY_PAGE_IDS,
    "underage-exit",
    "preface"
  ]);
});

test("guards every future page with persisted sequential prerequisites", () => {
  const inactive = createJourneyDraft({ id: "journey-1", now: "now" });
  const adultOnly = { ...inactive, ageConfirmed: true, currentPage: "final-preparation" as const };
  const welcomed = { ...adultOnly, addressPreference: "你" as const, prefaceRead: true, currentPage: "overnight" as const };
  const overnight = { ...welcomed, overnight: { stage: "concerns" as const, resumeStage: "concerns" as const } };
  const knowledge = {
    ...overnight,
    currentPage: "body-knowledge" as const,
    readKnowledgeCardIds: ["draft-knowledge-body-signals", "draft-knowledge-consent", "draft-knowledge-health"],
  };
  const mapped = {
    ...knowledge,
    currentPage: "behavior-map" as const,
    explicitContentConsent: false,
    behaviorAttitudes: Object.fromEntries([
      "behavior-hug", "draft-kissing", "behavior-same-bed", "behavior-my-nudity",
      "behavior-partner-nudity", "behavior-over-clothes-touch", "behavior-direct-touch",
    ].map((id) => [id, "skip" as const])),
  };
  const reflected = {
    ...mapped,
    currentPage: "reflection" as const,
    journal: { text: "", saveChoice: "not-saved" as const },
  };
  const practiced = {
    ...reflected,
    currentPage: "preset-practice" as const,
    practice: { ...reflected.practice, completed: true },
  };

  expect(canAccessJourneyPage(null, "welcome")).toBe(true);
  expect(canAccessJourneyPage(inactive, "overnight")).toBe(false);
  expect(canAccessJourneyPage(adultOnly, "overnight")).toBe(false);
  expect(canAccessJourneyPage(adultOnly, "final-preparation")).toBe(false);
  expect(canAccessJourneyPage(welcomed, "overnight")).toBe(true);
  expect(canAccessJourneyPage(welcomed, "body-knowledge")).toBe(false);
  expect(canAccessJourneyPage(overnight, "body-knowledge")).toBe(true);
  expect(canAccessJourneyPage(overnight, "behavior-map")).toBe(false);
  expect(canAccessJourneyPage(knowledge, "behavior-map")).toBe(true);
  expect(canAccessJourneyPage(knowledge, "reflection")).toBe(false);
  expect(canAccessJourneyPage(mapped, "reflection")).toBe(true);
  expect(canAccessJourneyPage(mapped, "preset-practice")).toBe(false);
  expect(canAccessJourneyPage(reflected, "preset-practice")).toBe(true);
  expect(canAccessJourneyPage(reflected, "final-preparation")).toBe(false);
  expect(canAccessJourneyPage(practiced, "final-preparation")).toBe(true);
});

test("supports deterministic next and back navigation", () => {
  expect(getAdjacentJourneyPage("reflection", -1)).toBe("behavior-map");
  expect(getAdjacentJourneyPage("reflection", 1)).toBe("preset-practice");
  expect(getAdjacentJourneyPage("welcome", -1)).toBeNull();
  expect(getAdjacentJourneyPage("final-preparation", 1)).toBeNull();
});

test("redirects legacy journey pages without reintroducing an eighth screen", () => {
  expect(resolveJourneyPageAlias("behavior-attitudes")).toBe("behavior-map");
  expect(resolveJourneyPageAlias("checklist")).toBe("final-preparation");
  expect(resolveJourneyPageAlias("communication-card")).toBe("final-preparation");
  expect(resolveJourneyPageAlias("reflection")).toBe("reflection");
  expect(resolveJourneyPageAlias("unknown-page")).toBeNull();
  expect(JOURNEY_PAGE_IDS).toHaveLength(7);
});

test("resumes at the persisted page and defaults to welcome", () => {
  expect(getResumePath(null)).toBe("/journey/welcome");
  expect(getResumePath({
    ...createJourneyDraft({ id: "journey-1", now: "now" }),
    ageConfirmed: true,
    currentPage: "final-preparation"
  })).toBe("/journey/welcome");
  expect(getResumePath({
    ...createJourneyDraft({ id: "journey-2", now: "now" }),
    ageConfirmed: true,
    addressPreference: "你",
    prefaceRead: true,
    currentPage: "overnight",
  })).toBe("/journey/overnight");
});

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

test("guards adult-only pages and supports deterministic next/back navigation", () => {
  const inactive = createJourneyDraft({ id: "journey-1", now: "now" });
  const active = { ...inactive, ageConfirmed: true };

  expect(canAccessJourneyPage(null, "welcome")).toBe(true);
  expect(canAccessJourneyPage(inactive, "overnight")).toBe(false);
  expect(canAccessJourneyPage(active, "overnight")).toBe(true);
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
  })).toBe("/journey/final-preparation");
});

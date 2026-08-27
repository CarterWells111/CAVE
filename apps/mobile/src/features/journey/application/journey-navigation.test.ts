import { createJourneyDraft } from "../domain/types";
import {
  JOURNEY_PAGE_IDS,
  JOURNEY_ROUTE_MANIFEST,
  canAccessJourneyPage,
  getAdjacentJourneyPage,
  getResumePath
} from "./journey-navigation";

test("freezes the eight canonical pages plus exit and overlay routes", () => {
  expect(JOURNEY_PAGE_IDS).toEqual([
    "welcome",
    "overnight",
    "body-knowledge",
    "behavior-attitudes",
    "reflection",
    "preset-practice",
    "checklist",
    "communication-card"
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
  expect(getAdjacentJourneyPage("reflection", -1)).toBe("behavior-attitudes");
  expect(getAdjacentJourneyPage("reflection", 1)).toBe("preset-practice");
  expect(getAdjacentJourneyPage("welcome", -1)).toBeNull();
  expect(getAdjacentJourneyPage("communication-card", 1)).toBeNull();
});

test("resumes at the persisted page and defaults to welcome", () => {
  expect(getResumePath(null)).toBe("/journey/welcome");
  expect(getResumePath({
    ...createJourneyDraft({ id: "journey-1", now: "now" }),
    ageConfirmed: true,
    currentPage: "checklist"
  })).toBe("/journey/checklist");
});

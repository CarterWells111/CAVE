import { buildChecklist } from "./derive-checklist";
import { createJourneyDraft } from "./types";

function draft() {
  return {
    ...createJourneyDraft({ id: "journey-1", now: "2026-08-27T08:00:00.000Z" }),
    ageConfirmed: true,
    expectationIds: ["draft-rest"],
    comfortNeedIds: ["draft-privacy"],
    expressionSupportNeeded: true,
    behaviorAttitudes: { "draft-kissing": "unsure" as const }
  };
}

test("derives stable non-ranked checklist items from the same input", () => {
  const first = buildChecklist(draft());
  const second = buildChecklist(draft());

  expect(second).toEqual(first);
  expect(first.map(({ id }) => id)).toEqual([
    "checklist:logistics",
    "checklist:attitude:draft-kissing",
    "checklist:expression",
    "checklist:comfort:draft-privacy"
  ]);
  expect(JSON.stringify(first)).not.toMatch(/score|percentage|readiness/iu);
});

test("only adds a sourced health item for a locally related selected behavior", () => {
  expect(buildChecklist({
    ...draft(),
    behaviorAttitudes: { "draft-penetrative-sex": "decide-in-moment" }
  })).toContainEqual(expect.objectContaining({
    id: "checklist:health:draft-penetrative-sex",
    category: "health",
    sourceIds: ["draft-source-sexual-health"]
  }));
  expect(buildChecklist(draft()).some(({ category }) => category === "health")).toBe(false);
});

test("preserves edits for still-applicable items and removes stale derived items", () => {
  const existing = buildChecklist(draft()).map((item) => item.id === "checklist:expression"
    ? { ...item, status: "considered" as const, userNote: "I want a pause phrase" }
    : item);
  const result = buildChecklist({
    ...draft(),
    expectationIds: [],
    comfortNeedIds: ["draft-time"],
    checklistItems: existing
  });

  expect(result).toContainEqual(expect.objectContaining({
    id: "checklist:expression",
    status: "considered",
    userNote: "I want a pause phrase"
  }));
  expect(result).toContainEqual(expect.objectContaining({
    id: "checklist:comfort:draft-time",
    status: "prepare-more"
  }));
  expect(result.some(({ id }) => id === "checklist:logistics")).toBe(false);
  expect(result.some(({ id }) => id === "checklist:comfort:draft-privacy")).toBe(false);
});

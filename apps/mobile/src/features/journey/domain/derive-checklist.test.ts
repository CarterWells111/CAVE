import { buildChecklist, buildPrivatePreparation } from "./derive-checklist";
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

test("uses the canonical content id for oral-genital contact health preparation", () => {
  const result = buildChecklist({
    ...draft(),
    behaviorAttitudes: { "behavior-oral-genital-contact": "decide-in-moment" }
  });

  expect(result).toContainEqual(expect.objectContaining({
    id: "checklist:health:behavior-oral-genital-contact",
    category: "health",
    sourceIds: ["draft-source-sexual-health"]
  }));
});

test("preserves edits for still-applicable items and removes stale derived items", () => {
  const existing = buildChecklist(draft()).map((item) => item.id === "checklist:expression"
    ? { ...item, status: "considered" as const, userNote: "I want a pause phrase" }
    : item);
  const result = buildChecklist({
    ...draft(),
    expectationIds: [],
    comfortNeedIds: ["draft-time"],
    privatePreparation: {
      ...draft().privatePreparation,
      items: existing
    }
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

test("produces the same checklist for semantically identical unordered input", () => {
  const first = createJourneyDraft({ id: "journey-1", now: "now" });
  first.behaviorAttitudes = { "draft-oral-sex": "unsure", "draft-kissing": "looking-forward" };
  first.comfortNeedIds = ["draft-quiet", "draft-breaks"];
  const second = createJourneyDraft({ id: "journey-1", now: "now" });
  second.behaviorAttitudes = { "draft-kissing": "looking-forward", "draft-oral-sex": "unsure" };
  second.comfortNeedIds = ["draft-breaks", "draft-quiet"];

  expect(buildChecklist(first)).toEqual(buildChecklist(second));
});

test("derives combined private preparation without disturbing private journal state", () => {
  const input = {
    ...draft(),
    journal: { text: "Keep this private reflection", saveChoice: "device" as const },
    privatePreparation: {
      items: [],
      excludedGroupIds: ["attitudes"],
      aftercareIds: ["rest"]
    }
  };

  expect(buildPrivatePreparation(input)).toMatchObject({
    excludedGroupIds: ["attitudes"],
    aftercareIds: ["rest"],
    items: expect.arrayContaining([expect.objectContaining({ id: "checklist:expression" })])
  });
  expect(input.journal.text).toBe("Keep this private reflection");
});

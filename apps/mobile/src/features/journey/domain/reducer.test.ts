import { JourneyDomainError, reduceJourneyDraft } from "./reducer";
import { createJourneyDraft } from "./types";

const NOW = "2026-08-27T08:00:00.000Z";

function adultDraft() {
  return { ...createJourneyDraft({ id: "journey-1", now: NOW }), ageConfirmed: true };
}

test("updates page-owned overnight fields and de-duplicates stable ids", () => {
  const original = adultDraft();
  const withExpectations = reduceJourneyDraft(original, {
    type: "set-expectation-ids",
    ids: ["draft-rest", "draft-rest", "draft-talk"]
  });
  const withConcerns = reduceJourneyDraft(withExpectations, {
    type: "set-concern-ids",
    ids: ["draft-pressure"]
  });
  const result = reduceJourneyDraft(withConcerns, {
    type: "set-overnight-custom-note",
    note: "Need a quiet exit option"
  });

  expect(result.expectationIds).toEqual(["draft-rest", "draft-talk"]);
  expect(result.concernIds).toEqual(["draft-pressure"]);
  expect(result.overnightCustomNote).toBe("Need a quiet exit option");
  expect(result.sourceRevision).toBe(3);
  expect(original.expectationIds).toEqual([]);
});

test("records knowledge actions without duplicating a read card", () => {
  const opened = reduceJourneyDraft(adultDraft(), { type: "set-medical-diagram-opened", opened: true });
  const readOnce = reduceJourneyDraft(opened, { type: "mark-knowledge-card-read", cardId: "draft-body-signals" });
  const readTwice = reduceJourneyDraft(readOnce, { type: "mark-knowledge-card-read", cardId: "draft-body-signals" });

  expect(readTwice.medicalDiagramOpened).toBe(true);
  expect(readTwice.readKnowledgeCardIds).toEqual(["draft-body-signals"]);
});

test("records non-ranked attitudes and manages custom behaviors", () => {
  const custom = reduceJourneyDraft(adultDraft(), {
    type: "add-custom-behavior",
    behavior: { id: "custom-1", label: "Holding hands" }
  });
  const attitudes = reduceJourneyDraft(custom, {
    type: "set-behavior-attitude",
    behaviorId: "custom-1",
    attitude: "not-this-time"
  });

  expect(attitudes.customBehaviors).toEqual([{ id: "custom-1", label: "Holding hands" }]);
  expect(attitudes.behaviorAttitudes).toEqual({ "custom-1": "not-this-time" });
  expect(reduceJourneyDraft(attitudes, { type: "remove-custom-behavior", behaviorId: "custom-1" }))
    .toMatchObject({ customBehaviors: [], behaviorAttitudes: {} });
});

test("updates reflection fields independently", () => {
  let draft = adultDraft();
  draft = reduceJourneyDraft(draft, { type: "set-motivation-ids", ids: ["draft-curious"] });
  draft = reduceJourneyDraft(draft, { type: "set-comfort-need-ids", ids: ["draft-privacy"] });
  draft = reduceJourneyDraft(draft, { type: "set-expression-support-needed", needed: false });
  draft = reduceJourneyDraft(draft, { type: "set-journal-save-choice", choice: "not-saved" });

  expect(draft).toMatchObject({
    motivationIds: ["draft-curious"],
    comfortNeedIds: ["draft-privacy"],
    expressionSupportNeeded: false,
    journalSaveChoice: "not-saved",
    cloudSaveAvailability: "coming-soon"
  });
});

test("rejects page 2-8 writes before adult confirmation", () => {
  expect(() => reduceJourneyDraft(createJourneyDraft({ id: "journey-1", now: NOW }), {
    type: "set-expectation-ids",
    ids: ["draft-rest"]
  })).toThrow(new JourneyDomainError("adult-confirmation-required"));
});

test("rejects blank or duplicate custom behaviors", () => {
  const draft = adultDraft();
  expect(() => reduceJourneyDraft(draft, {
    type: "add-custom-behavior",
    behavior: { id: "custom-1", label: "  " }
  })).toThrow(new JourneyDomainError("invalid-custom-behavior"));

  const existing = reduceJourneyDraft(draft, {
    type: "add-custom-behavior",
    behavior: { id: "custom-1", label: "Holding hands" }
  });
  expect(() => reduceJourneyDraft(existing, {
    type: "add-custom-behavior",
    behavior: { id: "custom-1", label: "Another label" }
  })).toThrow(new JourneyDomainError("duplicate-custom-behavior"));
});

test("never mutates a frozen input draft", () => {
  const draft = adultDraft();
  Object.freeze(draft);
  Object.freeze(draft.expectationIds);

  expect(reduceJourneyDraft(draft, { type: "set-expectation-ids", ids: ["draft-rest"] }))
    .toMatchObject({ expectationIds: ["draft-rest"] });
});

test("updates page 6 practice through one page-owned command", () => {
  const result = reduceJourneyDraft(adultDraft(), {
    type: "set-practice",
    practice: {
      behaviorId: "draft-kissing",
      intent: "slow-down",
      selectedPhraseId: "draft-phrase-slow-down",
      partnerResponseBranch: "supportive",
      completed: true
    }
  });

  expect(result.practice).toMatchObject({ behaviorId: "draft-kissing", completed: true });
  expect(result.sourceRevision).toBe(1);
});

test("edits checklist/card overrides and records points without changing source revision", () => {
  const base = {
    ...adultDraft(),
    checklistItems: [{
      id: "checklist:expression",
      category: "expression" as const,
      sourceIds: [],
      status: "prepare-more" as const
    }],
    communicationCard: {
      boundaries: {
        generatedText: "draft-card.boundaries",
        sourceRevision: 0,
        needsReview: true
      }
    }
  };
  let result = reduceJourneyDraft(base, {
    type: "update-checklist-item",
    itemId: "checklist:expression",
    status: "considered",
    userNote: "Use my pause phrase"
  });
  result = reduceJourneyDraft(result, {
    type: "edit-communication-card-field",
    sectionId: "boundaries",
    userText: "Please ask before continuing."
  });
  result = reduceJourneyDraft(result, { type: "confirm-communication-card-field-review", sectionId: "boundaries" });
  result = reduceJourneyDraft(result, { type: "record-point-event", key: "review:checklist:v1" });
  result = reduceJourneyDraft(result, { type: "record-point-event", key: "review:checklist:v1" });

  expect(result.checklistItems[0]).toMatchObject({ status: "considered", userNote: "Use my pause phrase" });
  expect(result.communicationCard.boundaries).toMatchObject({
    generatedText: "draft-card.boundaries",
    userText: "Please ask before continuing.",
    needsReview: false
  });
  expect(result.pointEventKeys).toEqual(["review:checklist:v1"]);
  expect(result.sourceRevision).toBe(0);
});

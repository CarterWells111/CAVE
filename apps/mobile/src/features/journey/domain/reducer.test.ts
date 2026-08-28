import { JourneyDomainError, reduceJourneyDraft } from "./reducer";
import type { JourneyCommand } from "./commands";
import { createJourneyDraft } from "./types";

const NOW = "2026-08-27T08:00:00.000Z";

function adultDraft() {
  return { ...createJourneyDraft({ id: "journey-1", now: NOW }), ageConfirmed: true };
}

test("updates page-owned overnight fields and de-duplicates stable ids", () => {
  const original = adultDraft();
  const result = reduceJourneyDraft(original, {
    type: "save-overnight-progress",
    completed: false,
    stage: "expectations",
    expectationIds: ["draft-rest", "draft-rest", "draft-talk"],
    concernIds: ["draft-pressure"],
    customNote: "Need a quiet exit option",
  });

  expect(result.expectationIds).toEqual(["draft-rest", "draft-talk"]);
  expect(result.concernIds).toEqual(["draft-pressure"]);
  expect(result.overnightCustomNote).toBe("Need a quiet exit option");
  expect(result.sourceRevision).toBe(1);
  expect(original.expectationIds).toEqual([]);
});

test("records first-page knowledge actions after the adult declaration without duplicating a read card", () => {
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
    journalSaveChoice: "not-saved"
  });
});

test("rejects adult-only writes before the adult declaration", () => {
  expect(() => reduceJourneyDraft(createJourneyDraft({ id: "journey-1", now: NOW }), {
    type: "save-overnight-progress",
    completed: false,
    stage: "expectations",
    expectationIds: ["draft-rest"],
    concernIds: [],
    customNote: "",
  })).toThrow(new JourneyDomainError("adult-confirmation-required"));
});

test("rejects every formerly exempt preface and knowledge write before the adult declaration", () => {
  const draft = createJourneyDraft({ id: "journey-1", now: NOW });
  const blockedCommands: JourneyCommand[] = [
    { type: "set-preface-read", read: true },
    { type: "set-address-preference", preference: "你" },
    { type: "mark-knowledge-card-read", cardId: "draft-knowledge-consent" },
    { type: "set-medical-diagram-opened", opened: true },
    { type: "record-point-event", key: "learning:body-signals:v1" },
  ];

  for (const command of blockedCommands) {
    expect(() => reduceJourneyDraft(draft, command))
      .toThrow(new JourneyDomainError("adult-confirmation-required"));
  }
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

  expect(reduceJourneyDraft(draft, {
    type: "save-overnight-progress",
    completed: false,
    stage: "expectations",
    expectationIds: ["draft-rest"],
    concernIds: [],
    customNote: "",
  }))
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
      mirrorRehearsed: false,
      completed: true
    }
  });

  expect(result.practice).toMatchObject({ behaviorId: "draft-kissing", completed: true });
  expect(result.sourceRevision).toBe(1);
});

test("edits checklist/card overrides and records points without changing source revision", () => {
  const base = {
    ...adultDraft(),
    privatePreparation: {
      ...adultDraft().privatePreparation,
      items: [{
        id: "checklist:expression",
        category: "expression" as const,
        sourceIds: [],
        status: "prepare-more" as const
      }]
    },
    communicationCard: {
      ...adultDraft().communicationCard,
      "communication-not-this-time": {
        generatedText: "draft-card.boundaries",
        sourceRevision: 0,
        needsReview: true,
        visibility: "pending" as const
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
    sectionId: "communication-not-this-time",
    userText: "Please ask before continuing."
  });
  result = reduceJourneyDraft(result, { type: "confirm-communication-card-field-review", sectionId: "communication-not-this-time" });
  result = reduceJourneyDraft(result, { type: "record-point-event", key: "review:checklist:v1" });
  result = reduceJourneyDraft(result, { type: "record-point-event", key: "review:checklist:v1" });

  expect(result.privatePreparation.items[0]).toMatchObject({ status: "considered", userNote: "Use my pause phrase" });
  expect(result.communicationCard["communication-not-this-time"]).toMatchObject({
    generatedText: "draft-card.boundaries",
    userText: "Please ask before continuing.",
    needsReview: false
  });
  expect(result.pointEventKeys).toEqual(["review:checklist:v1"]);
  expect(result.sourceRevision).toBe(0);
});

test("stores and resumes the overnight screen's two-stage local progress", () => {
  const concerns = reduceJourneyDraft(adultDraft(), {
    type: "save-overnight-progress",
    completed: false,
    stage: "concerns",
    expectationIds: [],
    concernIds: [],
    customNote: "",
  });

  expect(concerns.overnight).toEqual({ stage: "concerns", resumeStage: "concerns" });
  expect(concerns.sourceRevision).toBe(1);
});

test("atomically saves an overnight progress snapshot and completes it idempotently", () => {
  const result = reduceJourneyDraft(adultDraft(), {
    type: "save-overnight-progress",
    completed: true,
    stage: "concerns",
    expectationIds: ["expect-rest", "expect-rest"],
    concernIds: ["concern-space"],
    customNote: "想保留一点独处时间",
  });

  expect(result).toMatchObject({
    expectationIds: ["expect-rest"],
    concernIds: ["concern-space"],
    overnightCustomNote: "想保留一点独处时间",
    overnight: { stage: "concerns", resumeStage: "concerns" },
  });
  expect(result.pointEventKeys).toEqual(["progress:overnight-complete:v1"]);
  expect(reduceJourneyDraft(result, {
    type: "save-overnight-progress",
    completed: true,
    stage: "concerns",
    expectationIds: result.expectationIds,
    concernIds: result.concernIds,
    customNote: result.overnightCustomNote,
  }).pointEventKeys).toEqual(["progress:overnight-complete:v1"]);
});

test("changes communication visibility only through the four explicit privacy states", () => {
  const base = adultDraft();
  const included = reduceJourneyDraft(base, {
    type: "set-communication-card-visibility",
    sectionId: "communication-not-this-time",
    visibility: "included"
  });
  const privateAgain = reduceJourneyDraft(included, {
    type: "set-communication-card-visibility",
    sectionId: "communication-not-this-time",
    visibility: "private"
  });

  expect(included.communicationCard["communication-not-this-time"].visibility).toBe("included");
  expect(privateAgain.communicationCard["communication-not-this-time"].visibility).toBe("private");
  expect(privateAgain.sourceRevision).toBe(0);
});

test("persists address preference and explicit-content consent as adult-owned state", () => {
  const addressed = reduceJourneyDraft(adultDraft(), {
    type: "set-address-preference",
    preference: "妳",
  });
  const consented = reduceJourneyDraft(addressed, {
    type: "set-explicit-content-consent",
    consented: false,
  });

  expect(consented.addressPreference).toBe("妳");
  expect(consented.explicitContentConsent).toBe(false);
  expect(consented.sourceRevision).toBe(2);
});

test("atomically saves all reflection fields and clears journal content when it is not saved", () => {
  const saved = reduceJourneyDraft(adultDraft(), {
    type: "save-reflection",
    motivationIds: ["draft-curious", "draft-curious"],
    comfortNeedIds: ["draft-privacy"],
    expressionSupportNeeded: true,
    reflection: {
      pressureWithoutDisappointment: "slow-down",
      refusalSafety: "difficult-but-possible",
      expressionDifficulty: "needs-phrase",
      comfortClarity: "need-space",
      comfortNote: "先给我一点空间",
    },
    journal: {
      promptId: "journal-hesitation",
      text: "只留在本机",
      saveChoice: "device",
      savedAt: NOW,
    },
  });

  expect(saved).toMatchObject({
    motivationIds: ["draft-curious"],
    comfortNeedIds: ["draft-privacy"],
    expressionSupportNeeded: true,
    journalSaveChoice: "device",
    reflection: { comfortNote: "先给我一点空间", expressionDifficulty: "needs-phrase" },
    journal: { promptId: "journal-hesitation", text: "只留在本机", saveChoice: "device", savedAt: NOW },
    sourceRevision: 1,
  });

  const notSaved = reduceJourneyDraft(saved, {
    type: "save-reflection",
    motivationIds: [],
    comfortNeedIds: [],
    expressionSupportNeeded: null,
    reflection: saved.reflection,
    journal: { promptId: "journal-hesitation", text: "不得保留", saveChoice: "not-saved" },
  });
  expect(notSaved.journal).toEqual({ text: "", saveChoice: "not-saved" });
  expect(notSaved.journalSaveChoice).toBe("not-saved");
});

test("stores the canonical Page 6 submission without erasing legacy-compatible practice state", () => {
  const base = {
    ...adultDraft(),
    practice: { ...adultDraft().practice, selectedPhraseId: "legacy-phrase" },
  };
  const result = reduceJourneyDraft(base, {
    type: "save-practice-submission",
    submission: {
      behaviorId: null,
      intent: "pause-to-feel",
      phrase: "先停一下。",
      aftercareId: "space",
      optionalBranch: "ignores-or-blocks-exit",
      safetyTerminal: true,
      completed: true,
    },
  });

  expect(result.practice).toMatchObject({
    selectedPhraseId: "legacy-phrase",
    intent: "pause-to-feel",
    phrase: "先停一下。",
    aftercareId: "space",
    optionalBranch: "ignores-or-blocks-exit",
    safetyTerminal: true,
    completed: true,
  });
});

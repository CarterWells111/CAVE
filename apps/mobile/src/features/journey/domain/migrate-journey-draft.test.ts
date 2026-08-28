import {
  migrateJourneyDraftV1ToV2,
  migrateLegacyCommunicationCard,
  type JourneyDraftV1
} from "./migrate-journey-draft";

function legacyDraft(): JourneyDraftV1 {
  return {
    id: "journey-stable",
    schemaVersion: 1,
    currentPage: "communication-card",
    ageConfirmed: true,
    prefaceRead: true,
    expectationIds: ["rest"],
    concernIds: ["pressure"],
    overnightCustomNote: "quiet exit",
    readKnowledgeCardIds: ["body-response"],
    medicalDiagramOpened: true,
    behaviorAttitudes: { kissing: "unsure" },
    customBehaviors: [{ id: "custom-stable", label: "Hold hands" }],
    motivationIds: ["curious"],
    comfortNeedIds: ["ask-first"],
    expressionSupportNeeded: true,
    journalSaveChoice: "not-saved",
    cloudSaveAvailability: "coming-soon",
    practice: {
      behaviorId: "kissing",
      intent: "pause-and-decide",
      selectedPhraseId: "pause",
      editedPhrase: "Please pause.",
      partnerResponseBranch: "supportive",
      completed: true
    },
    checklistItems: [{
      id: "checklist:expression",
      category: "expression",
      sourceIds: [],
      status: "considered",
      userNote: "Use my phrase"
    }],
    communicationCard: {
      boundaries: {
        generatedText: "old generated boundary",
        userText: "Please ask before continuing.",
        sourceRevision: 8,
        needsReview: false
      }
    },
    pointEventKeys: ["learning:body:v1"],
    sourceRevision: 8,
    createdAt: "created",
    updatedAt: "updated"
  };
}

test("purely migrates all v1 edits into one private six-page final page", () => {
  const input = legacyDraft();
  const before = structuredClone(input);

  const migrated = migrateJourneyDraftV1ToV2(input);

  expect(input).toEqual(before);
  expect(migrated).toMatchObject({
    id: "journey-stable",
    schemaVersion: 2,
    currentPage: "final-preparation",
    addressPreference: null,
    ageConfirmed: true,
    expectationIds: ["rest"],
    behaviorAttitudes: { kissing: "unsure" },
    journalSaveChoice: "not-saved",
    practice: { editedPhrase: "Please pause.", completed: true },
    privatePreparation: {
      items: [expect.objectContaining({ id: "checklist:expression", userNote: "Use my phrase" })]
    },
    pointEventKeys: ["learning:body:v1"],
    sourceRevision: 8,
    createdAt: "created",
    updatedAt: "updated"
  });
  expect(migrated.communicationCard["communication-not-this-time"]).toMatchObject({
    userText: "Please ask before continuing.",
    visibility: "private",
    needsReview: true
  });
  expect(Object.values(migrated.communicationCard).some(({ visibility }) => visibility === "included"))
    .toBe(false);
});

test("starts a legacy welcome draft at the expectations stage", () => {
  const migrated = migrateJourneyDraftV1ToV2({
    ...legacyDraft(),
    currentPage: "body-knowledge"
  });

  expect(migrated.overnight).toEqual({
    stage: "expectations",
    resumeStage: "expectations"
  });
});

test("maps legacy no-expression-support into the legal can-say UI value", () => {
  const migrated = migrateJourneyDraftV1ToV2({
    ...legacyDraft(),
    expressionSupportNeeded: false
  });

  expect(migrated.reflection.expressionDifficulty).toBe("can-say");
});

test("migrates a legacy saved card without treating it as a seven-section record", () => {
  const migrated = migrateLegacyCommunicationCard({
    boundaries: {
      generatedText: "old boundary",
      userText: "Please ask first.",
      sourceRevision: 3,
      needsReview: false
    }
  });

  expect(Object.keys(migrated)).toHaveLength(7);
  expect(migrated["communication-not-this-time"]).toMatchObject({
    generatedText: "old boundary",
    userText: "Please ask first.",
    needsReview: true,
    visibility: "private"
  });
});

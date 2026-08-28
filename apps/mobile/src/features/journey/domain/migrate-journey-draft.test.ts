import {
  migrateJourneyDraftV1ToV3,
  migrateJourneyDraftV2ToV3,
  migrateLegacyCommunicationCard,
  type JourneyDraftV1,
  type JourneyDraftV2
} from "./migrate-journey-draft";
import { OVERNIGHT_COMPLETE_POINT_EVENT_KEY } from "../application/journey-progress-markers";
import { createJourneyDraft } from "./types";

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

test("purely migrates all v1 edits into one private schema v3 final page", () => {
  const input = legacyDraft();
  const before = structuredClone(input);

  const migrated = migrateJourneyDraftV1ToV3(input);

  expect(input).toEqual(before);
  expect(migrated).toMatchObject({
    id: "journey-stable",
    schemaVersion: 3,
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
    pointEventKeys: ["learning:body:v1", OVERNIGHT_COMPLETE_POINT_EVENT_KEY],
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
  const migrated = migrateJourneyDraftV1ToV3({
    ...legacyDraft(),
    currentPage: "body-knowledge"
  });

  expect(migrated.overnight).toEqual({
    stage: "expectations",
    resumeStage: "expectations"
  });
});

test("maps legacy no-expression-support into the legal can-say UI value", () => {
  const migrated = migrateJourneyDraftV1ToV3({
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

function legacyV2Draft(currentPage: JourneyDraftV2["currentPage"]): JourneyDraftV2 {
  const current = createJourneyDraft({ id: "journey-v2", now: "created" });
  return {
    ...current,
    schemaVersion: 2,
    currentPage,
    cloudSaveAvailability: "coming-soon",
    overnightCustomNote: "private overnight note",
    journal: {
      promptId: "private-prompt",
      text: "private journal text",
      saveChoice: "device",
      savedAt: "saved"
    },
    privatePreparation: {
      items: [],
      excludedGroupIds: ["private-group"],
      aftercareIds: ["private-aftercare"],
      customNeed: "private custom need"
    },
    communicationCard: {
      ...current.communicationCard,
      "communication-not-this-time": {
        generatedText: "generated boundary",
        userText: "private boundary edit",
        sourceRevision: 4,
        needsReview: true,
        visibility: "private"
      }
    },
    pointEventKeys: ["learning:body:v1"],
    updatedAt: "updated"
  };
}

function interimV2Draft(currentPage: "body-knowledge" | "overnight"): JourneyDraftV2 {
  return {
    ...createJourneyDraft({ id: "journey-interim-v2", now: "created" }),
    schemaVersion: 2,
    currentPage
  };
}

test("purely migrates an origin/main v2 welcome draft without dropping private fields", () => {
  const input = legacyV2Draft("welcome");
  const before = structuredClone(input);

  const migrated = migrateJourneyDraftV2ToV3(input);

  expect(input).toEqual(before);
  expect(migrated).toMatchObject({
    id: "journey-v2",
    schemaVersion: 3,
    currentPage: "body-knowledge",
    overnightCustomNote: "private overnight note",
    journal: { text: "private journal text" },
    privatePreparation: { customNeed: "private custom need" },
    pointEventKeys: ["learning:body:v1"]
  });
  expect(migrated.communicationCard["communication-not-this-time"].userText)
    .toBe("private boundary edit");
  expect(migrated).not.toHaveProperty("cloudSaveAvailability");
});

test.each([
  ["welcome", false],
  ["overnight", false],
  ["body-knowledge", true],
  ["behavior-map", true],
  ["reflection", true],
  ["preset-practice", true],
  ["final-preparation", true]
] as const)("derives overnight completion from a v2 %s page", (currentPage, completed) => {
  const migrated = migrateJourneyDraftV2ToV3(legacyV2Draft(currentPage));

  expect(migrated.pointEventKeys.includes(OVERNIGHT_COMPLETE_POINT_EVENT_KEY)).toBe(completed);
});

test("does not infer overnight completion from the interim v2 body-knowledge page", () => {
  const migrated = migrateJourneyDraftV2ToV3(interimV2Draft("body-knowledge"));

  expect(migrated.currentPage).toBe("body-knowledge");
  expect(migrated.pointEventKeys).not.toContain(OVERNIGHT_COMPLETE_POINT_EVENT_KEY);
});

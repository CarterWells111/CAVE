import { createJourneyDraft, type JourneyDraft } from "./types";

const VALID_DRAFT = {
  id: "journey-1",
  schemaVersion: 1,
  currentPage: "welcome",
  ageConfirmed: true,
  prefaceRead: false,
  expectationIds: [],
  concernIds: [],
  overnightCustomNote: "",
  readKnowledgeCardIds: [],
  medicalDiagramOpened: false,
  behaviorAttitudes: {},
  customBehaviors: [],
  motivationIds: [],
  comfortNeedIds: [],
  expressionSupportNeeded: null,
  journalSaveChoice: "device",
  cloudSaveAvailability: "coming-soon",
  practice: { completed: false },
  checklistItems: [],
  communicationCard: {},
  pointEventKeys: [],
  sourceRevision: 0,
  createdAt: "2026-08-27T08:00:00.000Z",
  updatedAt: "2026-08-27T08:00:00.000Z"
} satisfies JourneyDraft;

void VALID_DRAFT;

test("creates the deterministic local-only v1 draft defaults", () => {
  expect(createJourneyDraft({ id: "journey-1", now: "2026-08-27T08:00:00.000Z" })).toEqual({
    ...VALID_DRAFT,
    ageConfirmed: false
  });
});

test("the private draft rejects unfrozen values at compile time", () => {
  const invalidAge: JourneyDraft = {
    ...VALID_DRAFT,
    // @ts-expect-error age confirmation is boolean-only
    ageConfirmed: "yes"
  };
  const invalidVersion: JourneyDraft = {
    ...VALID_DRAFT,
    // @ts-expect-error schema v2 is not part of the frozen interface
    schemaVersion: 2
  };
  const invalidSaveChoice: JourneyDraft = {
    ...VALID_DRAFT,
    // @ts-expect-error cloud saving is deliberately unavailable
    journalSaveChoice: "cloud"
  };
  const invalidAttitude: JourneyDraft = {
    ...VALID_DRAFT,
    // @ts-expect-error attitudes are a fixed non-ranked union
    behaviorAttitudes: { kissing: "ready" }
  };

  expect([invalidAge, invalidVersion, invalidSaveChoice, invalidAttitude]).toHaveLength(4);
});

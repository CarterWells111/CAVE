import { JOURNEY_PAGE_IDS, createJourneyDraft, type JourneyDraft } from "./types";

test("exposes exactly the five current journey content page ids without standalone practice", () => {
  expect(JOURNEY_PAGE_IDS).toEqual([
    "body-knowledge",
    "overnight",
    "behavior-map",
    "reflection",
    "final-preparation"
  ]);
});

test("creates a private schema v4 draft with fail-closed final-screen defaults", () => {
  const draft = createJourneyDraft({ id: "journey-1", now: "2026-08-27T08:00:00.000Z" });

  expect(draft).toMatchObject({
    schemaVersion: 4,
    addressPreference: null,
    explicitContentConsent: null,
    overnight: { stage: "expectations", resumeStage: "expectations" },
    reflection: {
      pressureWithoutDisappointment: null,
      refusalSafety: null,
      expressionDifficulty: null,
      comfortClarity: null
    },
    journal: { text: "", saveChoice: "device" },
    practice: { completed: false, mirrorRehearsed: false },
    privatePreparation: { items: [], excludedGroupIds: [], aftercareIds: [] }
  });
  expect(Object.values(draft.communicationCard)).toHaveLength(7);
  expect(Object.keys(draft.communicationCard)).toEqual([
    "communication-night-expectations",
    "communication-possible-closeness",
    "communication-decide-in-moment",
    "communication-not-this-time",
    "communication-comfort",
    "communication-changed-feelings",
    "communication-mutual-boundaries"
  ]);
  expect(Object.values(draft.communicationCard).every(({ visibility }) => visibility === "pending"))
    .toBe(true);
});

test("the private v4 draft rejects unfrozen values at compile time", () => {
  const valid = { ...createJourneyDraft({ id: "journey-1", now: "now" }), ageConfirmed: true };
  const invalidAge: JourneyDraft = {
    ...valid,
    // @ts-expect-error age confirmation is boolean-only
    ageConfirmed: "yes"
  };
  const invalidVersion: JourneyDraft = {
    ...valid,
    // @ts-expect-error only schema v4 is current
    schemaVersion: 1
  };
  const invalidSaveChoice: JourneyDraft = {
    ...valid,
    // @ts-expect-error cloud saving is deliberately unavailable
    journalSaveChoice: "cloud"
  };
  const invalidAttitude: JourneyDraft = {
    ...valid,
    // @ts-expect-error attitudes are a fixed non-ranked union
    behaviorAttitudes: { kissing: "ready" }
  };

  const invalidVisibility: JourneyDraft = {
    ...valid,
    communicationCard: {
      ...valid.communicationCard,
      "communication-not-this-time": {
        ...valid.communicationCard["communication-not-this-time"],
        // @ts-expect-error no implicit/public share state exists
        visibility: "public"
      }
    }
  };

  expect([invalidAge, invalidVersion, invalidSaveChoice, invalidAttitude, invalidVisibility]).toHaveLength(5);
});

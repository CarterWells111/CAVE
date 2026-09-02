import { createJourneyDraft } from "../domain/types";
import {
  migrateJourneyDraftV2ToV3,
  migrateJourneyDraftV3ToV4,
  type JourneyDraftV2
} from "../domain/migrate-journey-draft";
import {
  JOURNEY_PAGE_IDS,
  JOURNEY_ROUTE_MANIFEST,
  resolveJourneyPageAlias,
  canAccessJourneyPage,
  getAdjacentJourneyPage,
  getResumePath,
  shouldEnableJourneyNativeBackGesture,
} from "./journey-navigation";

test("keeps native back gestures off formal journey pages without changing onboarding", () => {
  expect(shouldEnableJourneyNativeBackGesture("/journey/reflection", false)).toBe(false);
  expect(shouldEnableJourneyNativeBackGesture("/journey/body-knowledge", false)).toBe(false);
  expect(shouldEnableJourneyNativeBackGesture("/journey/welcome", false)).toBe(true);
  expect(shouldEnableJourneyNativeBackGesture("/journey/adult-gate", false)).toBe(true);
  expect(shouldEnableJourneyNativeBackGesture("/journey/preface", false)).toBe(true);
  expect(shouldEnableJourneyNativeBackGesture("/journey/welcome", true)).toBe(false);
});

test("freezes the six canonical content pages plus auxiliary onboarding routes", () => {
  expect(JOURNEY_PAGE_IDS).toEqual([
    "body-knowledge",
    "overnight",
    "behavior-map",
    "reflection",
    "preset-practice",
    "final-preparation"
  ]);
  expect(JOURNEY_ROUTE_MANIFEST).toEqual([
    "welcome",
    "preface",
    "adult-gate",
    ...JOURNEY_PAGE_IDS
  ]);
});

test.each(JOURNEY_PAGE_IDS)(
  "requires an adult declaration before accessing %s",
  (page) => {
    const unconfirmed = {
      ...createJourneyDraft({ id: "journey-1", now: "now" }),
      addressPreference: "你" as const,
      prefaceRead: true,
      readKnowledgeCardIds: ["draft-knowledge-body-signals", "draft-knowledge-consent", "draft-knowledge-health"],
      overnight: { stage: "concerns" as const, resumeStage: "concerns" as const },
      explicitContentConsent: false,
      behaviorAttitudes: Object.fromEntries([
        "behavior-hug", "draft-kissing", "behavior-same-bed", "behavior-my-nudity",
        "behavior-partner-nudity", "behavior-over-clothes-touch", "behavior-direct-touch",
      ].map((id) => [id, "skip" as const])),
      journal: { text: "", saveChoice: "not-saved" as const },
      practice: { ...createJourneyDraft({ id: "journey-1", now: "now" }).practice, completed: true },
    };

    expect(canAccessJourneyPage(null, page)).toBe(false);
    expect(canAccessJourneyPage(unconfirmed, page)).toBe(false);
  },
);

test("keeps address, preface, and sequential prerequisites after the adult declaration", () => {
  const adultConfirmed = {
    ...createJourneyDraft({ id: "journey-1", now: "now" }),
    ageConfirmed: true,
  };
  const welcomed = { ...adultConfirmed, addressPreference: "你" as const, prefaceRead: true };
  const knowledge = {
    ...welcomed,
    currentPage: "body-knowledge" as const,
    readKnowledgeCardIds: ["draft-knowledge-body-signals", "draft-knowledge-consent", "draft-knowledge-health"],
  };
  const overnight = {
    ...knowledge,
    currentPage: "overnight" as const,
    overnight: { stage: "concerns" as const, resumeStage: "concerns" as const },
    pointEventKeys: ["progress:overnight-complete:v1"],
  };
  const mapped = {
    ...overnight,
    currentPage: "behavior-map" as const,
    explicitContentConsent: false,
    pointEventKeys: ["progress:overnight-complete:v1", "progress:behavior-map-complete:v1"],
    behaviorAttitudes: Object.fromEntries([
      "behavior-hug", "draft-kissing", "behavior-same-bed", "behavior-my-nudity",
      "behavior-partner-nudity", "behavior-over-clothes-touch", "behavior-direct-touch",
    ].map((id) => [id, "skip" as const])),
  };
  const reflected = {
    ...mapped,
    currentPage: "reflection" as const,
    journal: { text: "", saveChoice: "not-saved" as const },
  };
  const practiced = {
    ...reflected,
    currentPage: "preset-practice" as const,
    practice: { ...reflected.practice, completed: true },
  };

  expect(canAccessJourneyPage(adultConfirmed, "body-knowledge")).toBe(false);
  expect(canAccessJourneyPage(welcomed, "body-knowledge")).toBe(true);
  expect(canAccessJourneyPage(welcomed, "overnight")).toBe(false);
  expect(canAccessJourneyPage(knowledge, "overnight")).toBe(true);
  expect(canAccessJourneyPage(knowledge, "behavior-map")).toBe(false);
  expect(canAccessJourneyPage(overnight, "behavior-map")).toBe(true);
  expect(canAccessJourneyPage(overnight, "reflection")).toBe(false);
  expect(canAccessJourneyPage({ ...mapped, pointEventKeys: [] }, "reflection")).toBe(false);
  expect(canAccessJourneyPage(mapped, "reflection")).toBe(true);
  expect(canAccessJourneyPage({
    ...mapped,
    behaviorAttitudes: {},
    explicitContentConsent: null,
  }, "reflection")).toBe(true);
  expect(canAccessJourneyPage(mapped, "preset-practice")).toBe(false);
  expect(canAccessJourneyPage(reflected, "preset-practice")).toBe(true);
  expect(canAccessJourneyPage(reflected, "final-preparation")).toBe(false);
  expect(canAccessJourneyPage(practiced, "final-preparation")).toBe(true);
});

test("allows only the persisted progress-jump target after onboarding is complete", () => {
  const welcomed = {
    ...createJourneyDraft({ id: "journey-demo", now: "now" }),
    ageConfirmed: true,
    addressPreference: "你" as const,
    prefaceRead: true,
    currentPage: "final-preparation" as const,
  };

  expect(canAccessJourneyPage(welcomed, "final-preparation")).toBe(true);
  expect(canAccessJourneyPage(welcomed, "reflection")).toBe(false);
  expect(getResumePath(welcomed)).toBe("/journey/final-preparation");
  expect(canAccessJourneyPage({ ...welcomed, prefaceRead: false }, "final-preparation")).toBe(false);
  expect(canAccessJourneyPage({ ...welcomed, addressPreference: null }, "final-preparation")).toBe(false);
  expect(canAccessJourneyPage({ ...welcomed, ageConfirmed: false }, "final-preparation")).toBe(false);
});

test("does not unlock the behavior map merely by entering concerns", () => {
  const concernsStage = {
    ...createJourneyDraft({ id: "journey-1", now: "now" }),
    ageConfirmed: true,
    addressPreference: "你" as const,
    prefaceRead: true,
    readKnowledgeCardIds: ["draft-knowledge-body-signals", "draft-knowledge-consent", "draft-knowledge-health"],
    overnight: { stage: "concerns" as const, resumeStage: "concerns" as const },
    expectationIds: [],
    concernIds: [],
  };

  expect(canAccessJourneyPage(concernsStage, "behavior-map")).toBe(false);
  expect(canAccessJourneyPage({
    ...concernsStage,
    pointEventKeys: ["progress:overnight-complete:v1"],
  }, "behavior-map")).toBe(true);
});

test("supports deterministic next and back navigation", () => {
  expect(getAdjacentJourneyPage("reflection", -1)).toBe("behavior-map");
  expect(getAdjacentJourneyPage("reflection", 1)).toBe("preset-practice");
  expect(getAdjacentJourneyPage("body-knowledge", -1)).toBeNull();
  expect(getAdjacentJourneyPage("final-preparation", 1)).toBeNull();
});

test("redirects legacy journey pages without reintroducing an eighth screen", () => {
  expect(resolveJourneyPageAlias("behavior-attitudes")).toBe("behavior-map");
  expect(resolveJourneyPageAlias("checklist")).toBe("final-preparation");
  expect(resolveJourneyPageAlias("communication-card")).toBe("final-preparation");
  expect(resolveJourneyPageAlias("reflection")).toBe("reflection");
  expect(resolveJourneyPageAlias("unknown-page")).toBeNull();
  expect(JOURNEY_PAGE_IDS).toHaveLength(6);
});

test("resumes at the persisted page and defaults to welcome", () => {
  expect(getResumePath(null)).toBe("/journey/welcome");
  expect(getResumePath(createJourneyDraft({ id: "journey-1", now: "now" }))).toBe("/journey/welcome");
  expect(getResumePath({
    ...createJourneyDraft({ id: "journey-2", now: "now" }),
    ageConfirmed: true,
    addressPreference: "你",
    prefaceRead: true,
    currentPage: "overnight",
    readKnowledgeCardIds: ["draft-knowledge-body-signals", "draft-knowledge-consent", "draft-knowledge-health"],
  })).toBe("/journey/overnight");
});

test("resumes a migrated v2 draft after overnight instead of falling back", () => {
  const current = createJourneyDraft({ id: "journey-v2", now: "now" });
  const oldDraft: JourneyDraftV2 = {
    ...current,
    schemaVersion: 2,
    currentPage: "behavior-map",
    cloudSaveAvailability: "coming-soon",
    ageConfirmed: true,
    addressPreference: "你",
    prefaceRead: true,
    readKnowledgeCardIds: [
      "draft-knowledge-body-signals",
      "draft-knowledge-consent",
      "draft-knowledge-health"
    ],
    pointEventKeys: []
  };

  expect(getResumePath(migrateJourneyDraftV3ToV4(migrateJourneyDraftV2ToV3(oldDraft))))
    .toBe("/journey/behavior-map");
});

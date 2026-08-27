import type { JourneyPracticeCatalog } from "@cave/content";

import { LocalPresetPracticeEngine, PresetPracticeError } from "./preset-practice-engine";
import type { PartnerResponseBranch, PracticeIntent } from "./practice-types";

const INTENTS: PracticeIntent[] = [
  "slow-down",
  "adjust-touch",
  "pause-and-decide",
  "stop-current-action",
  "choose-another-closeness",
  "pause-to-feel"
];

function catalog(): JourneyPracticeCatalog {
  return {
    version: "draft-v1",
    scripted: true,
    phrases: INTENTS.map((intent, index) => ({
      id: `draft-phrase-${intent}`,
      intent,
      order: index + 1,
      text: intent,
      page: 6,
      contentType: "UX",
      sourceIds: [],
      reviewStatus: "draft"
    })),
    responses: [
      { id: "support", page: 6, contentType: "UX", sourceIds: [], branch: "supportive", text: "support", scripted: true, safeTerminal: false, reviewStatus: "draft" },
      { id: "follow", page: 6, contentType: "UX", sourceIds: [], branch: "disappointed-follow-up", text: "follow", scripted: true, safeTerminal: false, reviewStatus: "draft" },
      { id: "stop", page: 6, contentType: "UX", sourceIds: [], branch: "ignores-pause", text: "stop", scripted: true, safeTerminal: true, reviewStatus: "draft" }
    ],
    partnerResponses: [],
    safetyBranches: [],
    supportResources: []
  };
}

test.each(INTENTS)("starts a transparent scripted %s practice from a selected behavior", (intent) => {
  const state = new LocalPresetPracticeEngine(catalog()).start({ behaviorId: "draft-kissing", intent });

  expect(state).toMatchObject({
    behaviorId: "draft-kissing",
    intent,
    catalogVersion: "draft-v1",
    scripted: true,
    phraseIds: [`draft-phrase-${intent}`]
  });
});

test("selects only a versioned phrase and rejects invalid runtime branches", () => {
  const engine = new LocalPresetPracticeEngine(catalog());
  const state = engine.start({ behaviorId: "draft-kissing", intent: "slow-down" });
  expect(engine.selectPhrase(state, "draft-phrase-slow-down").selectedPhraseId)
    .toBe("draft-phrase-slow-down");
  expect(() => engine.selectPhrase(state, "free-text")).toThrow(new PresetPracticeError("unknown-phrase"));
  expect(() => engine.choosePartnerResponse(state, "invalid" as PartnerResponseBranch))
    .toThrow(new PresetPracticeError("unknown-branch"));
});

test("ends safely when a pause is ignored and never creates a continuation", () => {
  const engine = new LocalPresetPracticeEngine(catalog());
  const state = engine.start({ behaviorId: "draft-kissing", intent: "pause-and-decide" });
  const result = engine.choosePartnerResponse(state, "ignores-pause");

  expect(result.safetyEnded).toBe(true);
  expect(result.response).toMatchObject({ safeTerminal: true, scripted: true });
  expect(result).not.toHaveProperty("nextPhraseIds");
});

test("requires a selected behavior before practice can start", () => {
  expect(() => new LocalPresetPracticeEngine(catalog()).start({ behaviorId: "", intent: "slow-down" }))
    .toThrow(new PresetPracticeError("behavior-required"));
});

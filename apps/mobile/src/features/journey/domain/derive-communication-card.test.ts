import {
  COMMUNICATION_CARD_CONSENT_FOOTER,
  buildCommunicationCard,
  COMMUNICATION_CARD_SECTION_IDS,
  normalizeCommunicationDraft,
  selectConfirmedCommunicationCard,
  selectConfirmedSavedCommunicationCard
} from "./derive-communication-card";
import {
  CURRENT_COMMUNICATION_CARD_SHARING_POLICY_VERSION,
  createJourneyDraft
} from "./types";

function draft() {
  return {
    ...createJourneyDraft({ id: "journey-1", now: "2026-08-27T08:00:00.000Z" }),
    ageConfirmed: true,
    expectationIds: ["draft-rest"],
    concernIds: ["draft-pressure"],
    comfortNeedIds: ["draft-privacy"],
    behaviorAttitudes: { "draft-kissing": "unsure" as const },
    sourceRevision: 3
  };
}

test("derives seven pending local sections at the current source revision", () => {
  const card = buildCommunicationCard(draft());

  expect(Object.keys(card)).toEqual(COMMUNICATION_CARD_SECTION_IDS);
  expect(Object.values(card).every((field) => field.sourceRevision === 3)).toBe(true);
  expect(Object.values(card).every((field) => field.needsReview === false)).toBe(true);
  expect(Object.values(card).every((field) => field.visibility === "pending")).toBe(true);
  expect(JSON.stringify(card)).not.toMatch(/score|percentage|readiness/iu);
});

test("generates user-readable Chinese without leaking template keys or raw option ids", () => {
  const input = {
    ...draft(),
    expectationIds: ["draft-expect-rest"],
    comfortNeedIds: ["draft-comfort-privacy"],
    behaviorAttitudes: { "draft-kissing": "looking-forward" as const }
  };

  const serialized = JSON.stringify(buildCommunicationCard(input));

  expect(serialized).toMatch(/[\u3400-\u9fff]/u);
  expect(serialized).not.toMatch(/draft-card|draft-expect-rest|draft-comfort-privacy|draft-kissing/u);
});

test("keeps familiar or enjoyed closeness separate from current willingness", () => {
  const input = {
    ...draft(),
    behaviorAttitudes: {
      "behavior-hug": "looking-forward" as const,
      "draft-kissing": "familiar-enjoyed" as const,
    },
  };

  const text = buildCommunicationCard(input)["communication-possible-closeness"].generatedText;

  expect(text).toContain("我可能愿意的靠近包括：拥抱或依偎。");
  expect(text).toContain("我熟悉或享受过、但仍会在当下重新确认的靠近包括：接吻。");
});

test("uses the canonical Page 6 phrase before legacy phrase fields", () => {
  const input = {
    ...draft(),
    practice: {
      ...draft().practice,
      phrase: "我现在想先停一下。",
      editedPhrase: "legacy edited phrase",
      selectedPhraseId: "draft-phrase-pause"
    }
  };

  const field = buildCommunicationCard(input)["communication-changed-feelings"];

  expect(field.generatedText).toContain("我现在想先停一下。");
  expect(field.generatedText).not.toMatch(/legacy edited phrase|draft-phrase-pause/u);
});

test("refreshes untouched fields but preserves user text and flags it for review", () => {
  const original = buildCommunicationCard(draft());
  const edited = {
    ...original,
    "communication-not-this-time": {
      ...original["communication-not-this-time"],
      userText: "Please ask before we continue."
    }
  };
  const changed = buildCommunicationCard({
    ...draft(),
    behaviorAttitudes: { "draft-kissing": "unsure", "draft-touch": "not-this-time" },
    sourceRevision: 4,
    communicationCard: edited
  });

  expect(changed["communication-not-this-time"]).toMatchObject({
    userText: "Please ask before we continue.",
    sourceRevision: 4,
    needsReview: true
  });
  expect(changed["communication-night-expectations"].userText).toBeUndefined();
  expect(changed["communication-night-expectations"].needsReview).toBe(false);
});

test("preserves every explicit privacy state across regeneration and normalization", () => {
  const input = buildCommunicationCard(draft());
  input["communication-comfort"].visibility = "deleted";
  input["communication-night-expectations"].visibility = "private";

  const rebuilt = buildCommunicationCard({ ...draft(), communicationCard: input, sourceRevision: 4 });
  expect(rebuilt["communication-comfort"].visibility).toBe("deleted");
  expect(rebuilt["communication-night-expectations"].visibility).toBe("private");
  expect(Object.values(normalizeCommunicationDraft(input)).map(({ visibility }) => visibility))
    .toContain("deleted");
  expect(Object.values(normalizeCommunicationDraft(input)).some(({ visibility }) => visibility === "private"))
    .toBe(true);
});

test("produces the same generated text for semantically identical unordered selections", () => {
  const first = createJourneyDraft({ id: "journey-1", now: "now" });
  first.expectationIds = ["draft-rest", "draft-connection"];
  first.concernIds = ["draft-privacy", "draft-pressure"];
  first.behaviorAttitudes = { "draft-oral-sex": "unsure", "draft-kissing": "looking-forward" };
  first.comfortNeedIds = ["draft-quiet", "draft-breaks"];
  const second = createJourneyDraft({ id: "journey-1", now: "now" });
  second.expectationIds = [...first.expectationIds].reverse();
  second.concernIds = [...first.concernIds].reverse();
  second.behaviorAttitudes = { "draft-kissing": "looking-forward", "draft-oral-sex": "unsure" };
  second.comfortNeedIds = [...first.comfortNeedIds].reverse();

  expect(buildCommunicationCard(first)).toEqual(buildCommunicationCard(second));
});

test("selects only explicitly included sections plus the fixed consent footer", () => {
  const card = buildCommunicationCard(draft());
  for (const field of Object.values(card)) field.visibility = "deleted";
  card["communication-night-expectations"] = {
    ...card["communication-night-expectations"],
    userText: "I hope we can rest together.",
    visibility: "included"
  };
  card["communication-not-this-time"] = {
    ...card["communication-not-this-time"], generatedText: "PRIVATE", visibility: "private"
  };
  card["communication-comfort"] = {
    ...card["communication-comfort"], generatedText: "DELETED", visibility: "deleted"
  };
  card["communication-changed-feelings"] = {
    ...card["communication-changed-feelings"],
    generatedText: "PENDING",
    visibility: "pending"
  };
  card["communication-mutual-boundaries"] = {
    ...card["communication-mutual-boundaries"],
    generatedText: "STALE INCLUDED",
    visibility: "included",
    needsReview: true
  };

  expect(selectConfirmedCommunicationCard({ ...draft(), communicationCard: card })).toEqual({
    sections: [{ id: "communication-night-expectations", text: "I hope we can rest together." }],
    consentFooter: COMMUNICATION_CARD_CONSENT_FOOTER
  });
  expect(JSON.stringify(selectConfirmedCommunicationCard({ ...draft(), communicationCard: card })))
    .not.toMatch(/PRIVATE|DELETED|PENDING|STALE INCLUDED/);
  expect(COMMUNICATION_CARD_CONSENT_FOOTER).toBe(
    "这张卡只代表我整理它时的感受。任何人都可以随时改变主意，每一种靠近仍然需要当时再次确认。"
  );
});

test("requires the current sharing policy before a saved card can be selected for export", () => {
  const card = buildCommunicationCard(draft());
  card["communication-night-expectations"].visibility = "included";
  const legacy = { id: "legacy", journeyId: "journey-1", card, savedAt: "now" };

  expect(selectConfirmedSavedCommunicationCard(legacy)).toBeNull();
  expect(selectConfirmedSavedCommunicationCard({
    ...legacy,
    sharingPolicyVersion: CURRENT_COMMUNICATION_CARD_SHARING_POLICY_VERSION
  })?.sections).toHaveLength(1);
});

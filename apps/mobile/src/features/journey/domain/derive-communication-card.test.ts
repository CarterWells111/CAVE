import {
  COMMUNICATION_CARD_CONSENT_FOOTER,
  buildCommunicationCard,
  COMMUNICATION_CARD_SECTION_IDS,
  selectConfirmedCommunicationCard
} from "./derive-communication-card";
import { createJourneyDraft } from "./types";

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

  expect(selectConfirmedCommunicationCard({ ...draft(), communicationCard: card })).toEqual({
    sections: [{ id: "communication-night-expectations", text: "I hope we can rest together." }],
    consentFooter: COMMUNICATION_CARD_CONSENT_FOOTER
  });
  expect(JSON.stringify(selectConfirmedCommunicationCard({ ...draft(), communicationCard: card })))
    .not.toMatch(/PRIVATE|DELETED|PENDING/);
  expect(COMMUNICATION_CARD_CONSENT_FOOTER).toBe(
    "这张卡只代表我整理它时的感受。任何人都可以随时改变主意，每一种靠近仍然需要当时再次确认。"
  );
});

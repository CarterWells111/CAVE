import { buildCommunicationCard, COMMUNICATION_CARD_SECTION_IDS } from "./derive-communication-card";
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

test("derives the fixed six local sections at the current source revision", () => {
  const card = buildCommunicationCard(draft());

  expect(Object.keys(card)).toEqual(COMMUNICATION_CARD_SECTION_IDS);
  expect(Object.values(card).every((field) => field.sourceRevision === 3)).toBe(true);
  expect(Object.values(card).every((field) => field.needsReview === false)).toBe(true);
  expect(JSON.stringify(card)).not.toMatch(/score|percentage|readiness/iu);
});

test("refreshes untouched fields but preserves user text and flags it for review", () => {
  const original = buildCommunicationCard(draft());
  const edited = {
    ...original,
    boundaries: { ...original.boundaries!, userText: "Please ask before we continue." }
  };
  const changed = buildCommunicationCard({
    ...draft(),
    concernIds: ["draft-space"],
    sourceRevision: 4,
    communicationCard: edited
  });

  expect(changed.boundaries).toMatchObject({
    userText: "Please ask before we continue.",
    sourceRevision: 4,
    needsReview: true
  });
  expect(changed.intentions?.userText).toBeUndefined();
  expect(changed.intentions?.needsReview).toBe(false);
});

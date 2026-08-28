import { COMMUNICATION_SECTION_IDS, type SavedCommunicationCardRecord } from "../../journey/domain/types";
import {
  applySavedCardSectionUpdates,
  buildEditableSavedCardSections,
  confirmSavedCardSharingPolicy,
} from "./saved-card-edit";

function record(): SavedCommunicationCardRecord {
  return {
    id: "card-1",
    journeyId: "journey-1",
    savedAt: "2026-08-28T10:00:00.000Z",
    card: Object.fromEntries(COMMUNICATION_SECTION_IDS.map((id, index) => [id, {
      generatedText: `generated-${index}`,
      ...(index === 1 ? { userText: "custom-text" } : {}),
      sourceRevision: 3,
      needsReview: index === 2,
      visibility: index === 0 ? "included" : index === 1 ? "private" : "pending",
    }])) as SavedCommunicationCardRecord["card"],
  };
}

test("builds all seven editable sections in canonical order without filtering visibility", () => {
  const sections = buildEditableSavedCardSections(record());

  expect(sections).toHaveLength(7);
  expect(sections.map(({ id }) => id)).toEqual(COMMUNICATION_SECTION_IDS);
  expect(sections[1]).toMatchObject({ text: "custom-text", visibility: "private" });
  expect(sections[2]).toMatchObject({ text: "generated-2", needsReview: true, visibility: "pending" });
  expect(sections.every(({ title }) => title.length > 0)).toBe(true);
});

test("applies only submitted section updates while preserving generated text and untouched fields", () => {
  const original = record();
  const updated = applySavedCardSectionUpdates(original, [
    {
      id: "communication-night-expectations",
      text: "  edited expectation  ",
      visibility: "private",
    },
    {
      id: "communication-comfort",
      text: "edited comfort",
      visibility: "deleted",
    },
  ]);

  expect(updated.card["communication-night-expectations"]).toEqual({
    ...original.card["communication-night-expectations"],
    userText: "edited expectation",
    visibility: "private",
    needsReview: false,
  });
  expect(updated.card["communication-night-expectations"].generatedText).toBe("generated-0");
  expect(updated.card["communication-comfort"]).toEqual({
    ...original.card["communication-comfort"],
    userText: "edited comfort",
    visibility: "deleted",
    needsReview: false,
  });
  expect(updated.card["communication-possible-closeness"]).toEqual(
    original.card["communication-possible-closeness"],
  );
  expect(updated.id).toBe(original.id);
  expect(updated.savedAt).toBe(original.savedAt);
  expect(updated.sharingPolicyVersion).toBeUndefined();
});

test("only the explicit confirmation transition stamps the current sharing policy", () => {
  const original = record();
  const edited = applySavedCardSectionUpdates(original, []);

  expect(edited.sharingPolicyVersion).toBeUndefined();
  expect(confirmSavedCardSharingPolicy(edited).sharingPolicyVersion).toBe(1);
});

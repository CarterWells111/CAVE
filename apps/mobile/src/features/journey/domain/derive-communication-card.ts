import type { EditableDerivedField, JourneyDraft } from "./types";

export const COMMUNICATION_CARD_SECTION_IDS = [
  "intentions",
  "boundaries",
  "pace",
  "comfort",
  "practical",
  "aftercare"
] as const;

function templates(draft: JourneyDraft): Record<(typeof COMMUNICATION_CARD_SECTION_IDS)[number], string> {
  const attitudes = Object.entries(draft.behaviorAttitudes)
    .map(([behaviorId, attitude]) => `${behaviorId}=${attitude}`)
    .join(",");
  return {
    intentions: `draft-card.intentions:${draft.expectationIds.join(",")}`,
    boundaries: `draft-card.boundaries:${draft.concernIds.join(",")}`,
    pace: `draft-card.pace:${attitudes}`,
    comfort: `draft-card.comfort:${draft.comfortNeedIds.join(",")}`,
    practical: `draft-card.practical:${draft.overnightCustomNote}`,
    aftercare: `draft-card.aftercare:${draft.practice.intent ?? ""}`
  };
}

export function buildCommunicationCard(draft: JourneyDraft): Record<string, EditableDerivedField> {
  const generated = templates(draft);
  return Object.fromEntries(COMMUNICATION_CARD_SECTION_IDS.map((sectionId) => {
    const previous = draft.communicationCard[sectionId];
    const generatedText = generated[sectionId];
    const userEdited = previous?.userText !== undefined;
    return [sectionId, {
      generatedText,
      ...(userEdited ? { userText: previous.userText } : {}),
      sourceRevision: draft.sourceRevision,
      needsReview: userEdited && previous.generatedText !== generatedText
    } satisfies EditableDerivedField];
  }));
}

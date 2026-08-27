import {
  COMMUNICATION_SECTION_IDS,
  type CommunicationSectionId,
  type EditableDerivedField,
  type JourneyDraft
} from "./types";

export const COMMUNICATION_CARD_SECTION_IDS = COMMUNICATION_SECTION_IDS;
export const COMMUNICATION_CARD_CONSENT_FOOTER =
  "每种行为都需要独立、持续且可撤回的同意。任何人都可以随时放慢、暂停或改变主意。";

function attitudesWith(draft: JourneyDraft, ...values: Array<JourneyDraft["behaviorAttitudes"][string]>) {
  return Object.entries(draft.behaviorAttitudes)
    .filter(([, attitude]) => values.includes(attitude))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([behaviorId]) => behaviorId)
    .join(",");
}

function templates(draft: JourneyDraft): Record<CommunicationSectionId, string> {
  return {
    "communication-night-expectations": `draft-card.night-expectations:${[...draft.expectationIds].sort().join(",")}`,
    "communication-possible-closeness": `draft-card.possible-closeness:${attitudesWith(draft, "looking-forward")}`,
    "communication-decide-in-moment": `draft-card.decide-in-moment:${attitudesWith(draft, "decide-in-moment", "unsure")}`,
    "communication-not-this-time": `draft-card.not-this-time:${attitudesWith(draft, "not-this-time")}`,
    "communication-comfort": `draft-card.comfort:${[...draft.comfortNeedIds].sort().join(",")}`,
    "communication-changed-feelings": `draft-card.changed-feelings:${draft.practice.editedPhrase ?? draft.practice.selectedPhraseId ?? ""}`,
    "communication-mutual-boundaries": "draft-card.mutual-boundaries"
  };
}

export function buildCommunicationCard(draft: JourneyDraft): JourneyDraft["communicationCard"] {
  const generated = templates(draft);
  return Object.fromEntries(COMMUNICATION_CARD_SECTION_IDS.map((sectionId) => {
    const previous = draft.communicationCard[sectionId];
    const generatedText = generated[sectionId];
    const userEdited = previous?.userText !== undefined;
    const generatedChanged = previous !== undefined && previous.generatedText !== generatedText;
    return [sectionId, {
      generatedText,
      ...(userEdited ? { userText: previous.userText } : {}),
      sourceRevision: draft.sourceRevision,
      needsReview: userEdited && (previous.needsReview || generatedChanged),
      visibility: userEdited && generatedChanged ? "pending" : previous?.visibility ?? "pending"
    } satisfies EditableDerivedField];
  })) as JourneyDraft["communicationCard"];
}

export type ConfirmedCommunicationCard = {
  sections: Array<{ id: CommunicationSectionId; text: string }>;
  consentFooter: typeof COMMUNICATION_CARD_CONSENT_FOOTER;
};

export function selectConfirmedCommunicationCard(draft: JourneyDraft): ConfirmedCommunicationCard {
  return {
    sections: COMMUNICATION_CARD_SECTION_IDS.flatMap((id) => {
      const field = draft.communicationCard[id];
      return field.visibility === "included"
        ? [{ id, text: field.userText ?? field.generatedText }]
        : [];
    }),
    consentFooter: COMMUNICATION_CARD_CONSENT_FOOTER
  };
}

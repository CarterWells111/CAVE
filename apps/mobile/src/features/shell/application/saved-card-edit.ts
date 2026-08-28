import {
  COMMUNICATION_SECTION_IDS,
  CURRENT_COMMUNICATION_CARD_SHARING_POLICY_VERSION,
  type CommunicationSectionId,
  type SavedCommunicationCardRecord,
  type SharingVisibility,
} from "../../journey/domain/types";

export type EditableSavedCardSection = Readonly<{
  id: CommunicationSectionId;
  title: string;
  text: string;
  visibility: SharingVisibility;
  needsReview: boolean;
}>;

export type SavedCardSectionUpdate = Readonly<{
  id: CommunicationSectionId;
  text: string;
  visibility: SharingVisibility;
}>;

const SECTION_TITLES: Readonly<Record<CommunicationSectionId, string>> = {
  "communication-night-expectations": "对这次相处的期待",
  "communication-possible-closeness": "可能愿意的靠近",
  "communication-decide-in-moment": "希望当下再决定",
  "communication-not-this-time": "这次不想做的事",
  "communication-comfort": "让我更安心的方式",
  "communication-changed-feelings": "感受变化时怎么说",
  "communication-mutual-boundaries": "共同边界",
};

export function buildEditableSavedCardSections(
  record: SavedCommunicationCardRecord,
): EditableSavedCardSection[] {
  return COMMUNICATION_SECTION_IDS.map((id) => {
    const field = record.card[id];
    return {
      id,
      title: SECTION_TITLES[id],
      text: field.userText ?? field.generatedText,
      visibility: field.visibility,
      needsReview: field.needsReview,
    };
  });
}

export function confirmSavedCardSharingPolicy(
  record: SavedCommunicationCardRecord
): SavedCommunicationCardRecord {
  return {
    ...record,
    sharingPolicyVersion: CURRENT_COMMUNICATION_CARD_SHARING_POLICY_VERSION
  };
}

export function applySavedCardSectionUpdates(
  record: SavedCommunicationCardRecord,
  updates: readonly SavedCardSectionUpdate[],
): SavedCommunicationCardRecord {
  const updatesById = new Map(updates.map((update) => [update.id, update]));
  return {
    ...record,
    card: Object.fromEntries(COMMUNICATION_SECTION_IDS.map((id) => {
      const field = record.card[id];
      const update = updatesById.get(id);
      if (update === undefined) return [id, field];
      const userText = update.text.trim();
      const changedText = userText !== (field.userText ?? field.generatedText);
      return [id, {
        ...field,
        userText,
        visibility: update.visibility === "included" && changedText ? "pending" : update.visibility,
        needsReview: false,
      }];
    })) as SavedCommunicationCardRecord["card"],
  };
}

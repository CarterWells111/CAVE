import type {
  BehaviorAttitude,
  ChecklistItem,
  CloudSaveAvailability,
  JournalSaveChoice,
  JourneyDraft
} from "./types";
import { createJourneyDraft, type CommunicationSectionId } from "./types";

type LegacyPageId =
  | "welcome"
  | "overnight"
  | "body-knowledge"
  | "behavior-attitudes"
  | "reflection"
  | "preset-practice"
  | "checklist"
  | "communication-card";

type LegacyEditableField = Omit<JourneyDraft["communicationCard"]["communication-not-this-time"], "visibility">;

export type JourneyDraftV1 = {
  id: string;
  schemaVersion: 1;
  currentPage: LegacyPageId;
  addressPreference?: unknown;
  ageConfirmed: boolean;
  prefaceRead: boolean;
  expectationIds: string[];
  concernIds: string[];
  overnightCustomNote: string;
  readKnowledgeCardIds: string[];
  medicalDiagramOpened: boolean;
  behaviorAttitudes: Record<string, BehaviorAttitude>;
  customBehaviors: Array<{ id: string; label: string }>;
  motivationIds: string[];
  comfortNeedIds: string[];
  expressionSupportNeeded: boolean | null;
  journalSaveChoice: JournalSaveChoice;
  cloudSaveAvailability: CloudSaveAvailability;
  practice: {
    behaviorId?: string;
    intent?: string;
    selectedPhraseId?: string;
    editedPhrase?: string;
    partnerResponseBranch?: string;
    completed: boolean;
  };
  checklistItems: ChecklistItem[];
  communicationCard: Record<string, LegacyEditableField>;
  pointEventKeys: string[];
  sourceRevision: number;
  createdAt: string;
  updatedAt: string;
};

const LEGACY_PAGE_MAP: Record<LegacyPageId, JourneyDraft["currentPage"]> = {
  welcome: "welcome",
  overnight: "overnight",
  "body-knowledge": "body-knowledge",
  "behavior-attitudes": "behavior-map",
  reflection: "reflection",
  "preset-practice": "preset-practice",
  checklist: "final-preparation",
  "communication-card": "final-preparation"
};

const LEGACY_SECTION_MAP: Record<string, CommunicationSectionId> = {
  intentions: "communication-night-expectations",
  pace: "communication-possible-closeness",
  practical: "communication-decide-in-moment",
  boundaries: "communication-not-this-time",
  comfort: "communication-comfort",
  aftercare: "communication-changed-feelings"
};

export function migrateLegacyCommunicationCard(
  input: Record<string, LegacyEditableField>
): JourneyDraft["communicationCard"] {
  const communicationCard = createJourneyDraft({ id: "legacy-card", now: "legacy" }).communicationCard;
  for (const [legacyId, legacyField] of Object.entries(input)) {
    const sectionId = LEGACY_SECTION_MAP[legacyId];
    if (sectionId === undefined) continue;
    const hasUserText = legacyField.userText !== undefined;
    communicationCard[sectionId] = {
      generatedText: legacyField.generatedText,
      ...(hasUserText ? { userText: legacyField.userText } : {}),
      sourceRevision: legacyField.sourceRevision,
      needsReview: hasUserText || legacyField.needsReview,
      visibility: hasUserText ? "private" : "pending"
    };
  }
  return communicationCard;
}

function cloneChecklist(items: ChecklistItem[]): ChecklistItem[] {
  return items.map((item) => ({
    ...item,
    sourceIds: [...item.sourceIds]
  }));
}

export function migrateJourneyDraftV1ToV2(input: JourneyDraftV1): JourneyDraft {
  const base = createJourneyDraft({ id: input.id, now: input.createdAt });
  const communicationCard = migrateLegacyCommunicationCard(input.communicationCard);
  const checklistItems = cloneChecklist(input.checklistItems);
  const overnightStage = input.currentPage === "overnight" && input.expectationIds.length > 0
    ? "concerns"
    : "expectations";

  return {
    ...base,
    currentPage: LEGACY_PAGE_MAP[input.currentPage],
    ageConfirmed: input.ageConfirmed,
    addressPreference: input.addressPreference === "你" || input.addressPreference === "妳"
      ? input.addressPreference
      : null,
    prefaceRead: input.prefaceRead,
    explicitContentConsent: null,
    overnight: { stage: overnightStage, resumeStage: overnightStage },
    expectationIds: [...input.expectationIds],
    concernIds: [...input.concernIds],
    overnightCustomNote: input.overnightCustomNote,
    readKnowledgeCardIds: [...input.readKnowledgeCardIds],
    medicalDiagramOpened: input.medicalDiagramOpened,
    behaviorAttitudes: { ...input.behaviorAttitudes },
    customBehaviors: input.customBehaviors.map((behavior) => ({ ...behavior })),
    motivationIds: [...input.motivationIds],
    comfortNeedIds: [...input.comfortNeedIds],
    expressionSupportNeeded: input.expressionSupportNeeded,
    reflection: {
      ...base.reflection,
      expressionDifficulty: input.expressionSupportNeeded === null
        ? null
        : input.expressionSupportNeeded ? "needs-phrase" : "can-say"
    },
    journalSaveChoice: input.journalSaveChoice,
    journal: { text: "", saveChoice: input.journalSaveChoice },
    cloudSaveAvailability: input.cloudSaveAvailability,
    practice: {
      ...input.practice,
      mirrorRehearsed: false
    },
    privatePreparation: {
      ...base.privatePreparation,
      items: cloneChecklist(checklistItems)
    },
    communicationCard,
    pointEventKeys: [...input.pointEventKeys],
    sourceRevision: input.sourceRevision,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
  };
}

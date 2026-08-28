import type {
  BehaviorAttitude,
  ChecklistItem,
  JournalSaveChoice,
  JourneyDraft
} from "./types";
import { createJourneyDraft, type CommunicationSectionId } from "./types";
import { OVERNIGHT_COMPLETE_POINT_EVENT_KEY } from "../application/journey-progress-markers";

type LegacyPageId =
  | "welcome"
  | "overnight"
  | "body-knowledge"
  | "behavior-attitudes"
  | "reflection"
  | "preset-practice"
  | "checklist"
  | "communication-card";

type JourneyDraftV2PageId =
  | "welcome"
  | "overnight"
  | "body-knowledge"
  | "behavior-map"
  | "reflection"
  | "preset-practice"
  | "final-preparation";

type JourneyDraftV2Base = Omit<JourneyDraft, "schemaVersion" | "currentPage"> & {
  schemaVersion: 2;
};

export type JourneyDraftV2 = JourneyDraftV2Base & ({
  currentPage: JourneyDraftV2PageId;
  cloudSaveAvailability: "coming-soon";
} | {
  currentPage: JourneyDraft["currentPage"];
  cloudSaveAvailability?: never;
});

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
  cloudSaveAvailability: "coming-soon";
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
  welcome: "body-knowledge",
  overnight: "overnight",
  "body-knowledge": "body-knowledge",
  "behavior-attitudes": "behavior-map",
  reflection: "reflection",
  "preset-practice": "preset-practice",
  checklist: "final-preparation",
  "communication-card": "final-preparation"
};

const V2_PAGE_MAP: Record<JourneyDraftV2PageId, JourneyDraft["currentPage"]> = {
  welcome: "body-knowledge",
  overnight: "overnight",
  "body-knowledge": "body-knowledge",
  "behavior-map": "behavior-map",
  reflection: "reflection",
  "preset-practice": "preset-practice",
  "final-preparation": "final-preparation"
};

const V1_PAGES_AFTER_OVERNIGHT = new Set<LegacyPageId>([
  "body-knowledge",
  "behavior-attitudes",
  "reflection",
  "preset-practice",
  "checklist",
  "communication-card"
]);

const ORIGIN_MAIN_V2_PAGES_AFTER_OVERNIGHT = new Set<JourneyDraftV2PageId>([
  "body-knowledge",
  "behavior-map",
  "reflection",
  "preset-practice",
  "final-preparation"
]);

const INTERIM_V2_PAGES_AFTER_OVERNIGHT = new Set<JourneyDraft["currentPage"]>([
  "behavior-map",
  "reflection",
  "preset-practice",
  "final-preparation"
]);

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
  for (const sectionId of Object.keys(communicationCard) as Array<keyof typeof communicationCard>) {
    communicationCard[sectionId] = { ...communicationCard[sectionId], visibility: "deleted" };
  }
  for (const [legacyId, legacyField] of Object.entries(input)) {
    const sectionId = LEGACY_SECTION_MAP[legacyId];
    if (sectionId === undefined) continue;
    const hasUserText = legacyField.userText !== undefined;
    communicationCard[sectionId] = {
      generatedText: legacyField.generatedText,
      ...(hasUserText ? { userText: legacyField.userText } : {}),
      sourceRevision: legacyField.sourceRevision,
      needsReview: hasUserText || legacyField.needsReview,
      visibility: "included"
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

function derivePointEventKeys(pointEventKeys: string[], overnightCompleted: boolean): string[] {
  const migrated = [...pointEventKeys];
  if (overnightCompleted && !migrated.includes(OVERNIGHT_COMPLETE_POINT_EVENT_KEY)) {
    migrated.push(OVERNIGHT_COMPLETE_POINT_EVENT_KEY);
  }
  return migrated;
}

export function migrateJourneyDraftV1ToV3(input: JourneyDraftV1): JourneyDraft {
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
    practice: {
      ...input.practice,
      mirrorRehearsed: false
    },
    privatePreparation: {
      ...base.privatePreparation,
      items: cloneChecklist(checklistItems)
    },
    communicationCard,
    pointEventKeys: derivePointEventKeys(
      input.pointEventKeys,
      V1_PAGES_AFTER_OVERNIGHT.has(input.currentPage)
    ),
    sourceRevision: input.sourceRevision,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
  };
}

export function migrateJourneyDraftV2ToV3(input: JourneyDraftV2): JourneyDraft {
  const overnightCompleted = input.cloudSaveAvailability === "coming-soon"
    ? ORIGIN_MAIN_V2_PAGES_AFTER_OVERNIGHT.has(input.currentPage)
    : INTERIM_V2_PAGES_AFTER_OVERNIGHT.has(input.currentPage);
  const { cloudSaveAvailability: legacyCloudSaveAvailability, ...currentPayload } = input;
  void legacyCloudSaveAvailability;

  return {
    ...currentPayload,
    schemaVersion: 3,
    currentPage: V2_PAGE_MAP[input.currentPage],
    pointEventKeys: derivePointEventKeys(
      input.pointEventKeys,
      overnightCompleted
    )
  };
}

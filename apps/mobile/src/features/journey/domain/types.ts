export const JOURNEY_PAGE_IDS = [
  "body-knowledge",
  "overnight",
  "behavior-map",
  "reflection",
  "preset-practice",
  "final-preparation"
] as const;

export type JourneyPageId = (typeof JOURNEY_PAGE_IDS)[number];

export type BehaviorAttitude =
  | "looking-forward"
  | "decide-in-moment"
  | "unsure"
  | "not-this-time"
  | "skip";

export type ChecklistItemStatus = "considered" | "prepare-more" | "not-relevant";
export type JournalSaveChoice = "not-saved" | "device";
export type AddressPreference = null | "你" | "妳";
export type SharingVisibility = "pending" | "included" | "private" | "deleted";
export type OvernightStage = "expectations" | "concerns";

export type JourneyReflection = {
  pressureWithoutDisappointment: string | null;
  refusalSafety: string | null;
  expressionDifficulty: string | null;
  comfortClarity: string | null;
  comfortNote: string;
};

export type JourneyPracticeSubmission = {
  behaviorId: string | null;
  intent: string;
  phrase: string;
  aftercareId: string;
  optionalBranch?: string;
  optionalResponse?: string;
  safetyTerminal: boolean;
  completed: true;
};

export const COMMUNICATION_SECTION_IDS = [
  "communication-night-expectations",
  "communication-possible-closeness",
  "communication-decide-in-moment",
  "communication-not-this-time",
  "communication-comfort",
  "communication-changed-feelings",
  "communication-mutual-boundaries"
] as const;

export type CommunicationSectionId = (typeof COMMUNICATION_SECTION_IDS)[number];

export type EditableDerivedField = {
  generatedText: string;
  userText?: string;
  sourceRevision: number;
  needsReview: boolean;
  visibility: SharingVisibility;
};

export type ChecklistItem = {
  id: string;
  category:
    | "attitude"
    | "expression"
    | "comfort"
    | "communication"
    | "logistics"
    | "health"
    | "aftercare";
  sourceIds: string[];
  status: ChecklistItemStatus;
  userNote?: string;
};

export type JourneyDraft = {
  id: string;
  schemaVersion: 2;
  currentPage: JourneyPageId;
  ageConfirmed: boolean;
  addressPreference: AddressPreference;
  prefaceRead: boolean;
  explicitContentConsent: boolean | null;
  overnight: {
    stage: OvernightStage;
    resumeStage: OvernightStage;
  };
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
  reflection: JourneyReflection;
  journalSaveChoice: JournalSaveChoice;
  journal: {
    promptId?: string;
    text: string;
    saveChoice: JournalSaveChoice;
    savedAt?: string;
  };
  practice: {
    behaviorId?: string;
    intent?: string;
    selectedPhraseId?: string;
    editedPhrase?: string;
    partnerResponseBranch?: string;
    responseId?: string;
    catalogVersion?: string;
    reflectionNote?: string;
    phrase?: string;
    aftercareId?: string;
    optionalBranch?: string;
    optionalResponse?: string;
    safetyTerminal?: boolean;
    mirrorRehearsed: boolean;
    completed: boolean;
  };
  privatePreparation: {
    items: ChecklistItem[];
    excludedGroupIds: string[];
    aftercareIds: string[];
    customNeed?: string;
  };
  communicationCard: Record<CommunicationSectionId, EditableDerivedField>;
  pointEventKeys: string[];
  sourceRevision: number;
  createdAt: string;
  updatedAt: string;
};

export type SavedCommunicationCardRecord = {
  id: string;
  journeyId: string;
  card: JourneyDraft["communicationCard"];
  savedAt: string;
};

export type SavedCommunicationCardMetadata = {
  id: string;
  journeyId: string;
  savedAt: string;
};

export function createJourneyDraft({ id, now }: { id: string; now: string }): JourneyDraft {
  return {
    id,
    schemaVersion: 2,
    currentPage: "body-knowledge",
    ageConfirmed: false,
    addressPreference: null,
    prefaceRead: false,
    explicitContentConsent: null,
    overnight: { stage: "expectations", resumeStage: "expectations" },
    expectationIds: [],
    concernIds: [],
    overnightCustomNote: "",
    readKnowledgeCardIds: [],
    medicalDiagramOpened: false,
    behaviorAttitudes: {},
    customBehaviors: [],
    motivationIds: [],
    comfortNeedIds: [],
    expressionSupportNeeded: null,
    reflection: {
      pressureWithoutDisappointment: null,
      refusalSafety: null,
      expressionDifficulty: null,
      comfortClarity: null,
      comfortNote: ""
    },
    journalSaveChoice: "device",
    journal: { text: "", saveChoice: "device" },
    practice: { completed: false, mirrorRehearsed: false },
    privatePreparation: { items: [], excludedGroupIds: [], aftercareIds: [] },
    communicationCard: Object.fromEntries(COMMUNICATION_SECTION_IDS.map((sectionId) => [sectionId, {
      generatedText: "",
      sourceRevision: 0,
      needsReview: false,
      visibility: "pending" as const
    }])) as JourneyDraft["communicationCard"],
    pointEventKeys: [],
    sourceRevision: 0,
    createdAt: now,
    updatedAt: now
  };
}

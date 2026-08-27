export type JourneyPageId =
  | "welcome"
  | "overnight"
  | "body-knowledge"
  | "behavior-attitudes"
  | "reflection"
  | "preset-practice"
  | "checklist"
  | "communication-card";

export type BehaviorAttitude =
  | "looking-forward"
  | "decide-in-moment"
  | "unsure"
  | "not-this-time"
  | "skip";

export type ChecklistItemStatus = "considered" | "prepare-more" | "not-relevant";
export type JournalSaveChoice = "not-saved" | "device";
export type CloudSaveAvailability = "coming-soon";

export type EditableDerivedField = {
  generatedText: string;
  userText?: string;
  sourceRevision: number;
  needsReview: boolean;
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
  schemaVersion: 1;
  currentPage: JourneyPageId;
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
  communicationCard: Record<string, EditableDerivedField>;
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

export function createJourneyDraft({ id, now }: { id: string; now: string }): JourneyDraft {
  return {
    id,
    schemaVersion: 1,
    currentPage: "welcome",
    ageConfirmed: false,
    prefaceRead: false,
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
    journalSaveChoice: "device",
    cloudSaveAvailability: "coming-soon",
    practice: { completed: false },
    checklistItems: [],
    communicationCard: {},
    pointEventKeys: [],
    sourceRevision: 0,
    createdAt: now,
    updatedAt: now
  };
}

import type {
  BehaviorAttitude,
  AddressPreference,
  ChecklistItemStatus,
  JourneyPracticeSubmission,
  JourneyReflection,
  JournalSaveChoice,
  JourneyDraft,
  OvernightStage
} from "./types";
import type { SharingVisibility } from "./types";

export type JourneyCommand =
  | { type: "set-preface-read"; read: boolean }
  | { type: "set-address-preference"; preference: Exclude<AddressPreference, null> }
  | { type: "set-explicit-content-consent"; consented: boolean }
  | {
      type: "save-overnight-progress";
      stage: OvernightStage;
      expectationIds: string[];
      concernIds: string[];
      customNote: string;
      completed: boolean;
    }
  | { type: "mark-knowledge-card-read"; cardId: string }
  | { type: "set-medical-diagram-opened"; opened: boolean }
  | { type: "set-behavior-attitude"; behaviorId: string; attitude: BehaviorAttitude }
  | { type: "add-custom-behavior"; behavior: { id: string; label: string } }
  | { type: "remove-custom-behavior"; behaviorId: string }
  | { type: "set-motivation-ids"; ids: string[] }
  | { type: "set-comfort-need-ids"; ids: string[] }
  | { type: "set-expression-support-needed"; needed: boolean | null }
  | { type: "set-journal-save-choice"; choice: JournalSaveChoice }
  | {
      type: "save-reflection";
      motivationIds: string[];
      comfortNeedIds: string[];
      expressionSupportNeeded: boolean | null;
      reflection: JourneyReflection;
      journal: JourneyDraft["journal"];
    }
  | { type: "set-practice"; practice: JourneyDraft["practice"] }
  | { type: "save-practice-submission"; submission: JourneyPracticeSubmission }
  | { type: "update-checklist-item"; itemId: string; status: ChecklistItemStatus; userNote?: string }
  | { type: "edit-communication-card-field"; sectionId: string; userText: string }
  | { type: "set-communication-card-visibility"; sectionId: string; visibility: SharingVisibility }
  | { type: "confirm-communication-card-field-review"; sectionId: string }
  | { type: "record-point-event"; key: string };

import type {
  BehaviorAttitude,
  ChecklistItemStatus,
  JournalSaveChoice,
  JourneyDraft
} from "./types";

export type JourneyCommand =
  | { type: "set-preface-read"; read: boolean }
  | { type: "set-expectation-ids"; ids: string[] }
  | { type: "set-concern-ids"; ids: string[] }
  | { type: "set-overnight-custom-note"; note: string }
  | { type: "mark-knowledge-card-read"; cardId: string }
  | { type: "set-medical-diagram-opened"; opened: boolean }
  | { type: "set-behavior-attitude"; behaviorId: string; attitude: BehaviorAttitude }
  | { type: "add-custom-behavior"; behavior: { id: string; label: string } }
  | { type: "remove-custom-behavior"; behaviorId: string }
  | { type: "set-motivation-ids"; ids: string[] }
  | { type: "set-comfort-need-ids"; ids: string[] }
  | { type: "set-expression-support-needed"; needed: boolean | null }
  | { type: "set-journal-save-choice"; choice: JournalSaveChoice }
  | { type: "set-practice"; practice: JourneyDraft["practice"] }
  | { type: "update-checklist-item"; itemId: string; status: ChecklistItemStatus; userNote?: string }
  | { type: "edit-communication-card-field"; sectionId: string; userText: string }
  | { type: "confirm-communication-card-field-review"; sectionId: string }
  | { type: "record-point-event"; key: string };

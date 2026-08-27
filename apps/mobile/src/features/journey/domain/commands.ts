import type { BehaviorAttitude, JournalSaveChoice } from "./types";

export type JourneyCommand =
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
  | { type: "set-journal-save-choice"; choice: JournalSaveChoice };

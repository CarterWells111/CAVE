import type { JourneyCommand } from "./commands";
import type { JourneyDraft } from "./types";

export class JourneyDomainError extends Error {
  constructor(readonly code: "adult-confirmation-required" | "invalid-custom-behavior" | "duplicate-custom-behavior") {
    super(code);
    this.name = "JourneyDomainError";
  }
}

function unique(ids: string[]) {
  return [...new Set(ids)];
}

function requireAdult(draft: JourneyDraft) {
  if (!draft.ageConfirmed) throw new JourneyDomainError("adult-confirmation-required");
}

function changed(draft: JourneyDraft, patch: Partial<JourneyDraft>): JourneyDraft {
  return { ...draft, ...patch, sourceRevision: draft.sourceRevision + 1 };
}

export function reduceJourneyDraft(draft: JourneyDraft, command: JourneyCommand): JourneyDraft {
  requireAdult(draft);

  switch (command.type) {
    case "set-expectation-ids":
      return changed(draft, { expectationIds: unique(command.ids) });
    case "set-concern-ids":
      return changed(draft, { concernIds: unique(command.ids) });
    case "set-overnight-custom-note":
      return changed(draft, { overnightCustomNote: command.note });
    case "mark-knowledge-card-read":
      return changed(draft, { readKnowledgeCardIds: unique([...draft.readKnowledgeCardIds, command.cardId]) });
    case "set-medical-diagram-opened":
      return changed(draft, { medicalDiagramOpened: command.opened });
    case "set-behavior-attitude":
      return changed(draft, {
        behaviorAttitudes: { ...draft.behaviorAttitudes, [command.behaviorId]: command.attitude }
      });
    case "add-custom-behavior": {
      const label = command.behavior.label.trim();
      if (label.length === 0) throw new JourneyDomainError("invalid-custom-behavior");
      if (draft.customBehaviors.some(({ id }) => id === command.behavior.id)) {
        throw new JourneyDomainError("duplicate-custom-behavior");
      }
      return changed(draft, {
        customBehaviors: [...draft.customBehaviors, { ...command.behavior, label }]
      });
    }
    case "remove-custom-behavior": {
      const behaviorAttitudes = { ...draft.behaviorAttitudes };
      delete behaviorAttitudes[command.behaviorId];
      return changed(draft, {
        customBehaviors: draft.customBehaviors.filter(({ id }) => id !== command.behaviorId),
        behaviorAttitudes
      });
    }
    case "set-motivation-ids":
      return changed(draft, { motivationIds: unique(command.ids) });
    case "set-comfort-need-ids":
      return changed(draft, { comfortNeedIds: unique(command.ids) });
    case "set-expression-support-needed":
      return changed(draft, { expressionSupportNeeded: command.needed });
    case "set-journal-save-choice":
      return changed(draft, { journalSaveChoice: command.choice });
  }
}

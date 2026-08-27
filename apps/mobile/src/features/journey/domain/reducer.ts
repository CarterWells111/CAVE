import type { JourneyCommand } from "./commands";
import type { JourneyDraft } from "./types";

export class JourneyDomainError extends Error {
  constructor(readonly code:
    | "adult-confirmation-required"
    | "invalid-custom-behavior"
    | "duplicate-custom-behavior"
    | "unknown-checklist-item"
    | "unknown-card-section") {
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

function userChanged(draft: JourneyDraft, patch: Partial<JourneyDraft>): JourneyDraft {
  return { ...draft, ...patch };
}

export function reduceJourneyDraft(draft: JourneyDraft, command: JourneyCommand): JourneyDraft {
  requireAdult(draft);

  switch (command.type) {
    case "set-preface-read":
      return changed(draft, { prefaceRead: command.read });
    case "set-address-preference":
      return changed(draft, { addressPreference: command.preference });
    case "set-explicit-content-consent":
      return changed(draft, { explicitContentConsent: command.consented });
    case "set-expectation-ids":
      return changed(draft, { expectationIds: unique(command.ids) });
    case "set-concern-ids":
      return changed(draft, { concernIds: unique(command.ids) });
    case "set-overnight-stage":
      return userChanged(draft, { overnight: { stage: command.stage, resumeStage: command.stage } });
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
    case "save-reflection": {
      const journal = command.journal.saveChoice === "not-saved"
        ? {
            ...(command.journal.promptId ? { promptId: command.journal.promptId } : {}),
            text: "",
            saveChoice: "not-saved" as const,
          }
        : { ...command.journal };
      return changed(draft, {
        motivationIds: unique(command.motivationIds),
        comfortNeedIds: unique(command.comfortNeedIds),
        expressionSupportNeeded: command.expressionSupportNeeded,
        reflection: { ...command.reflection },
        journalSaveChoice: journal.saveChoice,
        journal,
      });
    }
    case "set-practice":
      return changed(draft, { practice: { ...command.practice } });
    case "save-practice-submission": {
      const { behaviorId, ...submission } = command.submission;
      const practice: JourneyDraft["practice"] = {
        ...draft.practice,
        ...submission,
        ...(behaviorId === null ? {} : { behaviorId }),
      };
      if (behaviorId === null) delete practice.behaviorId;
      return changed(draft, { practice });
    }
    case "update-checklist-item": {
      if (!draft.privatePreparation.items.some(({ id }) => id === command.itemId)) {
        throw new JourneyDomainError("unknown-checklist-item");
      }
      return userChanged(draft, {
        privatePreparation: {
          ...draft.privatePreparation,
          items: draft.privatePreparation.items.map((item) => item.id === command.itemId
            ? {
                ...item,
                status: command.status,
                ...(command.userNote === undefined ? {} : { userNote: command.userNote })
              }
            : item)
        }
      });
    }
    case "edit-communication-card-field": {
      const field = draft.communicationCard[command.sectionId as keyof JourneyDraft["communicationCard"]];
      if (field === undefined) throw new JourneyDomainError("unknown-card-section");
      return userChanged(draft, {
        communicationCard: {
          ...draft.communicationCard,
          [command.sectionId]: { ...field, userText: command.userText, needsReview: false }
        }
      });
    }
    case "set-communication-card-visibility": {
      const field = draft.communicationCard[command.sectionId as keyof JourneyDraft["communicationCard"]];
      if (field === undefined) throw new JourneyDomainError("unknown-card-section");
      return userChanged(draft, {
        communicationCard: {
          ...draft.communicationCard,
          [command.sectionId]: { ...field, visibility: command.visibility }
        }
      });
    }
    case "confirm-communication-card-field-review": {
      const field = draft.communicationCard[command.sectionId as keyof JourneyDraft["communicationCard"]];
      if (field === undefined) throw new JourneyDomainError("unknown-card-section");
      return userChanged(draft, {
        communicationCard: {
          ...draft.communicationCard,
          [command.sectionId]: { ...field, needsReview: false }
        }
      });
    }
    case "record-point-event":
      return userChanged(draft, {
        pointEventKeys: unique([...draft.pointEventKeys, command.key])
      });
  }
}

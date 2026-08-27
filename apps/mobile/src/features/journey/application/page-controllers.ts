import type { BehaviorAttitude, ChecklistItemStatus, JournalSaveChoice, JourneyDraft } from "../domain/types";
import { selectConfirmedCommunicationCard } from "../domain/derive-communication-card";
import type {
  PartnerResponseBranch,
  PracticeIntent,
  PresetPracticeEngine
} from "../domain/practice-types";
import type { CommunicationCardRepository } from "../infrastructure/journey-draft-repository";
import type { JourneyApplicationService } from "./journey-application-service";

export interface ClipboardAdapter {
  setStringAsync(value: string): Promise<void>;
}

export type ClipboardCopyResult =
  | { status: "success" }
  | { status: "error"; code: "clipboard-write-failed" };

type Dependencies = {
  service: JourneyApplicationService;
  cards: CommunicationCardRepository;
  clipboard: ClipboardAdapter;
  practice: PresetPracticeEngine;
  now(): string;
};

export class JourneyPageController {
  constructor(private readonly dependencies: Dependencies) {}

  async enterWelcome({ adult, prefaceRead }: { adult: boolean; prefaceRead: boolean }) {
    if (!adult) return "underage-exit" as const;
    await this.dependencies.service.confirmAdult();
    await this.dependencies.service.dispatch({ type: "set-preface-read", read: prefaceRead });
    await this.dependencies.service.navigateTo("overnight");
    return "overnight" as const;
  }

  async saveOvernight(input: { expectationIds: string[]; concernIds: string[]; customNote: string }) {
    await this.dependencies.service.dispatch({ type: "set-expectation-ids", ids: input.expectationIds });
    await this.dependencies.service.dispatch({ type: "set-concern-ids", ids: input.concernIds });
    await this.dependencies.service.dispatch({ type: "set-overnight-custom-note", note: input.customNote });
  }

  async readKnowledge(cardId: string) {
    await this.dependencies.service.dispatch({ type: "mark-knowledge-card-read", cardId });
    await this.dependencies.service.dispatch({ type: "record-point-event", key: `learning:${cardId}:v1` });
  }

  openMedicalDiagram() {
    return this.dependencies.service.dispatch({ type: "set-medical-diagram-opened", opened: true });
  }

  setBehaviorAttitude(behaviorId: string, attitude: BehaviorAttitude) {
    return this.dependencies.service.dispatch({ type: "set-behavior-attitude", behaviorId, attitude });
  }

  async saveReflection(input: {
    motivationIds: string[];
    comfortNeedIds: string[];
    expressionSupportNeeded: boolean | null;
    journalSaveChoice: JournalSaveChoice;
  }) {
    await this.dependencies.service.dispatch({ type: "set-motivation-ids", ids: input.motivationIds });
    await this.dependencies.service.dispatch({ type: "set-comfort-need-ids", ids: input.comfortNeedIds });
    await this.dependencies.service.dispatch({ type: "set-expression-support-needed", needed: input.expressionSupportNeeded });
    await this.dependencies.service.dispatch({ type: "set-journal-save-choice", choice: input.journalSaveChoice });
    await this.dependencies.service.dispatch({ type: "record-point-event", key: "reflection:page-5:v1" });
  }

  async completePractice(input: {
    behaviorId: string;
    intent: PracticeIntent;
    phraseId: string;
    editedPhrase?: string;
    branch: PartnerResponseBranch;
  }) {
    const draft = this.requireDraft();
    const selected = Object.hasOwn(draft.behaviorAttitudes, input.behaviorId)
      || draft.customBehaviors.some(({ id }) => id === input.behaviorId);
    if (!selected) throw new Error("practice-behavior-not-selected");
    const started = this.dependencies.practice.start({ behaviorId: input.behaviorId, intent: input.intent });
    const selectedPhrase = this.dependencies.practice.selectPhrase(started, input.phraseId);
    const completed = this.dependencies.practice.choosePartnerResponse(selectedPhrase, input.branch);
    await this.dependencies.service.dispatch({
      type: "set-practice",
      practice: {
        behaviorId: completed.behaviorId,
        intent: completed.intent,
        selectedPhraseId: input.phraseId,
        ...(input.editedPhrase === undefined ? {} : { editedPhrase: input.editedPhrase }),
        partnerResponseBranch: input.branch,
        mirrorRehearsed: draft.practice.mirrorRehearsed,
        completed: true
      }
    });
    await this.dependencies.service.dispatch({
      type: "record-point-event",
      key: `practice:${completed.scenarioId}:${completed.catalogVersion}`
    });
  }

  updateChecklist(itemId: string, status: ChecklistItemStatus, userNote?: string) {
    return this.dependencies.service.dispatch({
      type: "update-checklist-item",
      itemId,
      status,
      ...(userNote === undefined ? {} : { userNote })
    });
  }

  finishChecklistReview() {
    return this.dependencies.service.dispatch({ type: "record-point-event", key: "review:checklist:v1" });
  }

  editCommunicationCard(sectionId: string, userText: string) {
    return this.dependencies.service.dispatch({ type: "edit-communication-card-field", sectionId, userText });
  }

  async saveCommunicationCard() {
    const draft = this.requireDraft();
    await this.dependencies.cards.save({
      id: `card:${draft.id}`,
      journeyId: draft.id,
      card: draft.communicationCard,
      savedAt: this.dependencies.now()
    });
  }

  async copyCommunicationCard(): Promise<ClipboardCopyResult> {
    const cardText = formatCommunicationCard(this.requireDraft());
    try {
      await this.dependencies.clipboard.setStringAsync(cardText);
      return { status: "success" };
    } catch {
      return { status: "error", code: "clipboard-write-failed" };
    }
  }

  private requireDraft(): JourneyDraft {
    const draft = this.dependencies.service.getSnapshot();
    if (draft === null) throw new Error("journey-not-active");
    return draft;
  }
}

export function formatCommunicationCard(draft: JourneyDraft) {
  const confirmed = selectConfirmedCommunicationCard(draft);
  return [
    ...confirmed.sections.map(({ text }) => text),
    confirmed.consentFooter
  ].join("\n\n");
}

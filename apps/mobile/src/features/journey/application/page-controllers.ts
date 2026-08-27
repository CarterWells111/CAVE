import type { BehaviorAttitude, ChecklistItemStatus, JournalSaveChoice, JourneyDraft } from "../domain/types";
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
    const started = this.dependencies.practice.start({ behaviorId: input.behaviorId, intent: input.intent });
    const selected = this.dependencies.practice.selectPhrase(started, input.phraseId);
    const completed = this.dependencies.practice.choosePartnerResponse(selected, input.branch);
    await this.dependencies.service.dispatch({
      type: "set-practice",
      practice: {
        behaviorId: completed.behaviorId,
        intent: completed.intent,
        selectedPhraseId: input.phraseId,
        ...(input.editedPhrase === undefined ? {} : { editedPhrase: input.editedPhrase }),
        partnerResponseBranch: input.branch,
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

  async copyCommunicationCard() {
    await this.dependencies.clipboard.setStringAsync(formatCommunicationCard(this.requireDraft()));
  }

  private requireDraft(): JourneyDraft {
    const draft = this.dependencies.service.getSnapshot();
    if (draft === null) throw new Error("journey-not-active");
    return draft;
  }
}

export function formatCommunicationCard(draft: JourneyDraft) {
  return Object.values(draft.communicationCard)
    .map((field) => field.userText ?? field.generatedText)
    .join("\n\n");
}

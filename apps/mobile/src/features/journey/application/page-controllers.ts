import type {
  AddressPreference,
  BehaviorAttitude,
  ChecklistItemStatus,
  JournalSaveChoice,
  JourneyDraft,
  JourneyPracticeSubmission,
} from "../domain/types";
import { selectConfirmedCommunicationCard } from "../domain/derive-communication-card";
import type { ConfirmedCommunicationCard } from "../domain/derive-communication-card";
import type {
  PartnerResponseBranch,
  PracticeIntent,
  PresetPracticeEngine
} from "../domain/practice-types";
import type { CommunicationCardRepository } from "../infrastructure/journey-draft-repository";
import type { AppShellStateRepository } from "../../shell/infrastructure/app-shell-state-repository";
import type { ReviewHistoryRepository } from "../../reviews/infrastructure/review-history-repository";
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
  shellState: AppShellStateRepository;
  clipboard: ClipboardAdapter;
  practice: PresetPracticeEngine;
  now(): string;
  reviewHistory?: ReviewHistoryRepository<JourneyDraft>;
};

type ReflectionInput = {
  motivationIds: string[];
  comfortNeedIds: string[];
  expressionSupportNeeded?: boolean | null;
  pressureWithoutDisappointment?: string | null;
  refusalSafety?: string | null;
  expressionDifficulty?: string | null;
  comfortClarity?: string | null;
  comfortNote?: string;
  journalPromptId?: string;
  journalText?: string;
  journalSaveChoice: JournalSaveChoice;
};

type LegacyPracticeInput = {
  behaviorId: string;
  intent: PracticeIntent;
  phraseId: string;
  editedPhrase?: string;
  branch: PartnerResponseBranch;
};

type CanonicalPracticeInput = {
  behaviorId: string | null;
  intent: PracticeIntent;
  phrase: string;
  aftercareId: string;
  completed: true;
  pointEventKey?: string;
  optionalBranch?: string;
  optionalResponse?: string;
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

  setAddressPreference(preference: Exclude<AddressPreference, null>) {
    return this.dependencies.service.dispatch({ type: "set-address-preference", preference });
  }

  setExplicitContentConsent(consented: boolean) {
    return this.dependencies.service.dispatch({ type: "set-explicit-content-consent", consented });
  }

  async saveOvernight(input: { expectationIds: string[]; concernIds: string[]; customNote: string }) {
    await this.dependencies.service.dispatch({
      type: "save-overnight",
      expectationIds: input.expectationIds,
      concernIds: input.concernIds,
      customNote: input.customNote,
    });
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

  async saveReflection(input: ReflectionInput) {
    const draft = this.requireDraft();
    const expressionSupportNeeded = input.expressionSupportNeeded !== undefined
      ? input.expressionSupportNeeded
      : input.expressionDifficulty !== undefined
        ? input.expressionDifficulty === null ? null : input.expressionDifficulty === "needs-phrase"
        : draft.expressionSupportNeeded;
    const reflection = {
      pressureWithoutDisappointment: input.pressureWithoutDisappointment === undefined
        ? draft.reflection.pressureWithoutDisappointment
        : input.pressureWithoutDisappointment,
      refusalSafety: input.refusalSafety === undefined ? draft.reflection.refusalSafety : input.refusalSafety,
      expressionDifficulty: input.expressionDifficulty === undefined
        ? draft.reflection.expressionDifficulty
        : input.expressionDifficulty,
      comfortClarity: input.comfortClarity === undefined ? draft.reflection.comfortClarity : input.comfortClarity,
      comfortNote: input.comfortNote === undefined ? draft.reflection.comfortNote : input.comfortNote,
    };
    const journal = input.journalSaveChoice === "not-saved"
      ? {
          text: "",
          saveChoice: "not-saved" as const,
        }
      : {
          ...((input.journalPromptId ?? draft.journal.promptId)
            ? { promptId: input.journalPromptId ?? draft.journal.promptId }
            : {}),
          text: input.journalText ?? draft.journal.text,
          saveChoice: "device" as const,
          savedAt: this.dependencies.now(),
        };
    await this.dependencies.service.dispatch({
      type: "save-reflection",
      motivationIds: input.motivationIds,
      comfortNeedIds: input.comfortNeedIds,
      expressionSupportNeeded,
      reflection,
      journal,
    });
    const hasReflection = input.motivationIds.length > 0
      || input.comfortNeedIds.length > 0
      || Object.values(reflection).some((answer) => typeof answer === "string"
        ? answer.trim().length > 0
        : answer !== null)
      || (journal.saveChoice === "device" && journal.text.trim().length > 0);
    if (hasReflection) {
      await this.dependencies.service.dispatch({ type: "record-point-event", key: "reflection:page-5:v1" });
    }
  }

  async completePractice(input: LegacyPracticeInput | CanonicalPracticeInput) {
    if ("completed" in input) return this.completeCanonicalPractice(input);
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

  private async completeCanonicalPractice(input: CanonicalPracticeInput) {
    const draft = this.requireDraft();
    if (input.behaviorId !== null) {
      const selected = Object.hasOwn(draft.behaviorAttitudes, input.behaviorId)
        || draft.customBehaviors.some(({ id }) => id === input.behaviorId);
      if (!selected) throw new Error("practice-behavior-not-selected");
    }
    const phrase = input.phrase.trim();
    const aftercareId = input.aftercareId.trim();
    if (!phrase || !aftercareId) throw new Error("practice-completion-required");
    const safetyTerminal = input.optionalBranch === "ignores-or-blocks-exit";
    const submission: JourneyPracticeSubmission = {
      behaviorId: input.behaviorId,
      intent: input.intent,
      phrase,
      aftercareId,
      ...(input.optionalBranch ? { optionalBranch: input.optionalBranch } : {}),
      ...(input.optionalResponse ? { optionalResponse: input.optionalResponse } : {}),
      safetyTerminal,
      completed: true,
    };
    await this.dependencies.service.dispatch({ type: "save-practice-submission", submission });
    if (
      !safetyTerminal
      && input.pointEventKey !== undefined
      && /^practice:[^:]+:first-completion$/u.test(input.pointEventKey)
    ) {
      await this.dependencies.service.dispatch({ type: "record-point-event", key: input.pointEventKey });
    }
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

  async saveCommunicationCard(confirmedCard?: ConfirmedCommunicationCard) {
    const draft = this.requireDraft();
    const confirmed = confirmedCard ?? selectConfirmedCommunicationCard(draft);
    const included = new Map(confirmed.sections.map((section) => [section.id, section.text]));
    const card = Object.fromEntries(Object.entries(draft.communicationCard).map(([sectionId, field]) => {
      const text = included.get(sectionId as keyof JourneyDraft["communicationCard"]);
      return [sectionId, text === undefined
        ? {
            generatedText: "",
            sourceRevision: field.sourceRevision,
            needsReview: false,
            visibility: "deleted" as const
          }
        : {
            generatedText: text,
            sourceRevision: field.sourceRevision,
            needsReview: false,
            visibility: "included" as const
          }];
    })) as JourneyDraft["communicationCard"];
    await this.dependencies.cards.save({
      id: `card:${draft.id}`,
      journeyId: draft.id,
      card,
      savedAt: this.dependencies.now()
    });
  }

  async completeInitialJourney(confirmedCard: ConfirmedCommunicationCard) {
    const draft = this.requireDraft();
    await this.saveCommunicationCard(confirmedCard);
    const versionId = `review:${draft.id}:completed`;
    if (this.dependencies.reviewHistory !== undefined
      && await this.dependencies.reviewHistory.loadDetail(versionId) === null) {
      const active = await this.dependencies.reviewHistory.loadActive();
      await this.dependencies.reviewHistory.appendVersionAndClearActive({
        id: versionId,
        rootId: active?.rootId ?? draft.id,
        parentVersionId: active?.sourceVersionId ?? null,
        title: active?.title ?? `回顾 ${draft.updatedAt.slice(0, 10)}`,
        createdAt: this.dependencies.now(),
        status: "completed",
        payload: draft,
      });
    }
    await this.dependencies.shellState.completeInitialJourney({
      initialJourneyId: draft.id,
      initialJourneyCompletedAt: this.dependencies.now()
    });
    await this.dependencies.service.resetJourney();
  }

  async copyCommunicationCard(): Promise<ClipboardCopyResult> {
    return this.copyConfirmedCommunicationCard(selectConfirmedCommunicationCard(this.requireDraft()));
  }

  async copyConfirmedCommunicationCard(card: ConfirmedCommunicationCard): Promise<ClipboardCopyResult> {
    const cardText = formatConfirmedCommunicationCard(card);
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
  return formatConfirmedCommunicationCard(selectConfirmedCommunicationCard(draft));
}

export function formatConfirmedCommunicationCard(confirmed: ConfirmedCommunicationCard) {
  return [
    ...confirmed.sections.map(({ text }) => text),
    confirmed.consentFooter
  ].join("\n\n");
}

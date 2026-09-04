import type { JourneyCommand } from "../domain/commands";
import { buildPrivatePreparation } from "../domain/derive-checklist";
import { buildCommunicationCard } from "../domain/derive-communication-card";
import { reduceJourneyDraft } from "../domain/reducer";
import { createJourneyDraft, type JourneyDraft, type JourneyPageId } from "../domain/types";
import { JourneyStorageError, type JourneyDraftRepository } from "../infrastructure/journey-draft-repository";
import type { PreferenceValues } from "../../account/application/account-preferences-service";

export type JourneyRecoveryState = "ready" | "recovery-required";

export interface JourneyApplicationService {
  getSnapshot(): JourneyDraft | null;
  confirmAdult(): Promise<void>;
  dispatch(command: JourneyCommand): Promise<void>;
  navigateTo(page: JourneyPageId): Promise<void>;
  resetJourney(): Promise<void>;
  adoptCompletedJourney?(): void;
  adoptPersistedJourney?(draft: JourneyDraft): void;
}

type Dependencies = {
  createId(): string;
  now(): string;
};

export class DefaultJourneyApplicationService implements JourneyApplicationService {
  private snapshot: JourneyDraft | null = null;
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly repository: JourneyDraftRepository,
    private readonly dependencies: Dependencies
  ) {}

  getSnapshot() {
    return this.snapshot;
  }

  async initialize(): Promise<JourneyRecoveryState> {
    try {
      this.snapshot = await this.repository.loadActive();
      return "ready";
    } catch (error) {
      if (!(error instanceof JourneyStorageError)) throw error;
      this.snapshot = null;
      return "recovery-required";
    }
  }

  applyAccountPreferences(preferences: PreferenceValues): Promise<void> {
    return this.enqueue(async () => {
      const current = this.snapshot;
      if (current === null) return;
      if (current.ageConfirmed === preferences.ageConfirmed && current.addressPreference === preferences.addressPreference) return;
      const next = { ...current, ...preferences, updatedAt: this.dependencies.now() };
      await this.persist({ ...next, communicationCard: buildCommunicationCard(next) });
    });
  }

  confirmAdult(): Promise<void> {
    return this.enqueue(async () => {
      if (this.snapshot?.ageConfirmed === true) return;
      const now = this.dependencies.now();
      const current = this.snapshot ?? createJourneyDraft({ id: this.dependencies.createId(), now });
      const next = {
        ...current,
        ageConfirmed: true,
        prefaceRead: false,
        currentPage: "body-knowledge" as const,
        updatedAt: now,
      };
      await this.persist(next);
    });
  }

  dispatch(command: JourneyCommand): Promise<void> {
    return this.enqueue(async () => {
      const current = this.requireActive();
      const reduced = { ...reduceJourneyDraft(current, command), updatedAt: this.dependencies.now() };
      const withChecklist = { ...reduced, privatePreparation: buildPrivatePreparation(reduced) };
      const next = {
        ...withChecklist,
        communicationCard: buildCommunicationCard(withChecklist)
      };
      await this.persist(next);
    });
  }

  navigateTo(page: JourneyPageId): Promise<void> {
    return this.enqueue(async () => {
      const current = this.requireActive();
      await this.persist({ ...current, currentPage: page, updatedAt: this.dependencies.now() });
    });
  }

  resetJourney(): Promise<void> {
    return this.enqueue(async () => {
      await this.repository.deleteActive();
      this.snapshot = null;
    });
  }

  adoptCompletedJourney(): void {
    this.snapshot = null;
  }

  adoptPersistedJourney(draft: JourneyDraft): void {
    this.snapshot = draft;
  }

  private requireActive(): JourneyDraft {
    if (this.snapshot === null || !this.snapshot.ageConfirmed) throw new Error("journey-not-active");
    return this.snapshot;
  }

  private async persist(next: JourneyDraft) {
    await this.repository.saveActive(next);
    this.snapshot = next;
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const scheduled = this.tail.then(operation, operation);
    this.tail = scheduled.catch(() => undefined);
    return scheduled;
  }
}

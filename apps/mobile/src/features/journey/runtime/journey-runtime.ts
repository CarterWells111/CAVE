import { DefaultJourneyApplicationService } from "../application/journey-application-service";
import {
  JourneyPageController,
  type ClipboardAdapter
} from "../application/page-controllers";
import { LocalPresetPracticeEngine } from "../domain/preset-practice-engine";
import type {
  CommunicationCardRepository,
  JourneyDraftRepository
} from "../infrastructure/journey-draft-repository";
import { loadJourneyContentCatalog } from "../infrastructure/journey-content-catalog";
import {
  InMemoryCommunicationCardRepository,
  InMemoryJourneyDraftRepository
} from "../infrastructure/in-memory-journey-repositories";
import type { AppShellStateRepository } from "../../shell/infrastructure/app-shell-state-repository";
import { InMemoryAppShellStateRepository } from "../../shell/infrastructure/in-memory-app-shell-state-repository";
import type { ReviewHistoryRepository } from "../../reviews/infrastructure/review-history-repository";
import { InMemoryPayloadReviewHistoryRepository } from "../../reviews/infrastructure/in-memory-payload-review-history-repository";
import { VersionedJourneyDraftRepository } from "../../reviews/infrastructure/versioned-journey-draft-repository";
import type { ActiveReview } from "../../reviews/infrastructure/review-history-repository";
import type { JourneyBranchTransaction, JourneyCompletionTransaction } from "../infrastructure/journey-write-coordinator";
import type { JourneyDraft } from "../domain/types";
import type { DatabaseSecretRepository } from "../../../core/storage/key-store";
import {
  InMemoryAppearancePreferencesRepository,
  type AppearancePreferencesRepository,
} from "../../../core/design/appearance-preferences";
import { JournalService } from "../../journal/application/journal-service";
import { InMemoryJournalRepository } from "../../journal/infrastructure/in-memory-journal-repository";
import type { JournalRepository } from "../../journal/infrastructure/journal-repository";

export type JourneyRuntimeMode = "expo-go-demo" | "native-secure";
export type JourneyRuntimePersistence = "memory-only" | "sqlcipher-secure-store";
export type AdultDeclarationRepository = Pick<
  DatabaseSecretRepository,
  | "hasAdultDeclaration"
  | "recordAdultDeclaration"
  | "deleteAdultDeclaration"
  | "hasPendingLocalDataDeletion"
>;

export type JourneyRuntime = {
  mode: JourneyRuntimeMode;
  persistence: JourneyRuntimePersistence;
  service: DefaultJourneyApplicationService;
  controller: JourneyPageController;
  drafts: JourneyDraftRepository;
  cards: CommunicationCardRepository;
  shellState: AppShellStateRepository;
  reviewHistory: ReviewHistoryRepository<JourneyDraft>;
  adultDeclaration: AdultDeclarationRepository;
  appearancePreferences: AppearancePreferencesRepository;
  journal: JournalRepository;
  createJournalService(ownerAccountId: string): JournalService;
  deleteAllData(): Promise<void>;
  replaceActiveReview(): Promise<void>;
  branchFromReview(draft: JourneyDraft, lineage: { rootId: string; sourceVersionId: string; title: string }): Promise<void>;
};

type RuntimeDependencies = {
  clipboard: ClipboardAdapter;
  createId(): string;
  now(): string;
};

type ComposeDependencies = RuntimeDependencies & {
  mode: JourneyRuntimeMode;
  persistence: JourneyRuntimePersistence;
  drafts: JourneyDraftRepository;
  cards: CommunicationCardRepository;
  shellState?: AppShellStateRepository;
  reviewHistory?: ReviewHistoryRepository<JourneyDraft>;
  appearancePreferences?: AppearancePreferencesRepository;
  journal?: JournalRepository;
  deleteStorage?: () => Promise<void>;
  deleteAdditionalStorage?: () => Promise<void>;
  saveVersionedDraft?: (draft: JourneyDraft, active: ActiveReview<JourneyDraft>) => Promise<void>;
  completeJourney?: (transaction: JourneyCompletionTransaction) => Promise<void>;
  branchReview?: (transaction: JourneyBranchTransaction) => Promise<void>;
  adultDeclaration?: AdultDeclarationRepository;
};

type CreateDependencies = RuntimeDependencies & {
  executionEnvironment: string;
  deleteAdditionalStorage?: () => Promise<void>;
  createNativeRuntime(): Promise<JourneyRuntime>;
};

export function resolveJourneyRuntimeMode(executionEnvironment: string): JourneyRuntimeMode {
  return executionEnvironment === "storeClient" ? "expo-go-demo" : "native-secure";
}

export function composeJourneyRuntime({
  mode,
  persistence,
  drafts,
  cards,
  shellState = new InMemoryAppShellStateRepository(),
  reviewHistory = new InMemoryPayloadReviewHistoryRepository<JourneyDraft>(),
  appearancePreferences = new InMemoryAppearancePreferencesRepository(),
  journal = new InMemoryJournalRepository(),
  saveVersionedDraft,
  completeJourney,
  branchReview,
  adultDeclaration = {
    hasAdultDeclaration: async () => true,
    recordAdultDeclaration: async () => undefined,
    deleteAdultDeclaration: async () => undefined,
    hasPendingLocalDataDeletion: async () => false
  },
  deleteStorage,
  deleteAdditionalStorage,
  clipboard,
  createId,
  now
}: ComposeDependencies): JourneyRuntime {
  const versionedDrafts = new VersionedJourneyDraftRepository(drafts, reviewHistory, saveVersionedDraft);
  const service = new DefaultJourneyApplicationService(versionedDrafts, { createId, now });
  const controller = new JourneyPageController({
    service,
    cards,
    shellState,
    reviewHistory,
    ...(completeJourney === undefined ? {} : { completeAtomically: completeJourney }),
    clipboard,
    practice: new LocalPresetPracticeEngine(loadJourneyContentCatalog().practice),
    now
  });
  const createJournalService = (ownerAccountId: string) => new JournalService(
    journal,
    { createId, now },
    ownerAccountId,
  );
  const deleteAllData = async () => {
    if (deleteStorage !== undefined) {
      await deleteStorage();
      service.adoptCompletedJourney();
      return;
    }
    const savedCards = await cards.listMetadata();
    await Promise.all(savedCards.map(({ id }) => cards.delete(id)));
    await shellState.clear();
    await reviewHistory.clearAll();
    await journal.clearAll();
    await appearancePreferences.save("system");
    await service.resetJourney();
    await deleteAdditionalStorage?.();
  };
  const replaceActiveReview = async () => {
    const persistedActive = await reviewHistory.loadActive();
    const legacyDraft = service.getSnapshot();
    const active = persistedActive ?? (legacyDraft === null ? null : {
      id: `active:${legacyDraft.id}`, rootId: legacyDraft.id, sourceVersionId: null,
      title: "迁移的未完成回顾", updatedAt: legacyDraft.updatedAt, payload: legacyDraft,
    });
    if (active !== null) {
      const id = `review:${active.payload.id}:incomplete`;
      if (await reviewHistory.loadDetail(id) === null) {
        await reviewHistory.appendVersionAndClearActive({ id, rootId: active.rootId, parentVersionId: active.sourceVersionId, title: active.title, createdAt: active.updatedAt, status: "incomplete", payload: active.payload });
      }
    }
    await service.resetJourney();
  };
  const branchFromReview = async (draft: JourneyDraft, lineage: { rootId: string; sourceVersionId: string; title: string }) => {
    const current = await reviewHistory.loadActive();
    const archivedActive = current === null ? null : {
      id: `review:${current.payload.id}:incomplete`, rootId: current.rootId,
      parentVersionId: current.sourceVersionId, title: current.title, createdAt: current.updatedAt,
      status: "incomplete" as const, payload: current.payload,
    };
    const active = { id: `active:${draft.id}`, ...lineage, updatedAt: draft.updatedAt, payload: draft };
    if (branchReview !== undefined) {
      await branchReview({ archivedActive, branch: draft, active });
    } else {
      if (archivedActive !== null && await reviewHistory.loadDetail(archivedActive.id) === null) {
        await reviewHistory.appendVersionAndClearActive(archivedActive);
      }
      await service.resetJourney();
      await versionedDrafts.saveWithLineage(draft, lineage);
    }
    service.adoptPersistedJourney(draft);
  };
  return { mode, persistence, service, controller, drafts: versionedDrafts, cards, shellState, reviewHistory, adultDeclaration, appearancePreferences, journal, createJournalService, deleteAllData, replaceActiveReview, branchFromReview };
}

export async function createJourneyRuntime({
  executionEnvironment,
  clipboard,
  createId,
  now,
  deleteAdditionalStorage,
  createNativeRuntime
}: CreateDependencies): Promise<JourneyRuntime> {
  if (resolveJourneyRuntimeMode(executionEnvironment) === "expo-go-demo") {
    return composeJourneyRuntime({
      mode: "expo-go-demo",
      persistence: "memory-only",
      drafts: new InMemoryJourneyDraftRepository(),
      cards: new InMemoryCommunicationCardRepository(),
      clipboard,
      createId,
      now,
      ...(deleteAdditionalStorage === undefined ? {} : { deleteAdditionalStorage }),
    });
  }
  return createNativeRuntime();
}

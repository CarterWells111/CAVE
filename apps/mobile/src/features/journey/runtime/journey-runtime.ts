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
import type { JourneyDraft } from "../domain/types";

export type JourneyRuntimeMode = "expo-go-demo" | "native-secure";
export type JourneyRuntimePersistence = "memory-only" | "sqlcipher-secure-store";

export type JourneyRuntime = {
  mode: JourneyRuntimeMode;
  persistence: JourneyRuntimePersistence;
  service: DefaultJourneyApplicationService;
  controller: JourneyPageController;
  drafts: JourneyDraftRepository;
  cards: CommunicationCardRepository;
  shellState: AppShellStateRepository;
  reviewHistory: ReviewHistoryRepository<JourneyDraft>;
  deleteAllData(): Promise<void>;
  replaceActiveReview(): Promise<void>;
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
  deleteStorage?: () => Promise<void>;
};

type CreateDependencies = RuntimeDependencies & {
  executionEnvironment: string;
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
  deleteStorage,
  clipboard,
  createId,
  now
}: ComposeDependencies): JourneyRuntime {
  const versionedDrafts = new VersionedJourneyDraftRepository(drafts, reviewHistory);
  const service = new DefaultJourneyApplicationService(versionedDrafts, { createId, now });
  const controller = new JourneyPageController({
    service,
    cards,
    shellState,
    reviewHistory,
    clipboard,
    practice: new LocalPresetPracticeEngine(loadJourneyContentCatalog().practice),
    now
  });
  const deleteAllData = async () => {
    if (deleteStorage !== undefined) {
      await deleteStorage();
      await service.resetJourney();
      return;
    }
    const savedCards = await cards.listMetadata();
    await Promise.all(savedCards.map(({ id }) => cards.delete(id)));
    await shellState.clear();
    await reviewHistory.clearAll();
    await service.resetJourney();
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
        await reviewHistory.appendVersion({ id, rootId: active.rootId, parentVersionId: active.sourceVersionId, title: active.title, createdAt: active.updatedAt, status: "incomplete", payload: active.payload });
      }
    }
    await service.resetJourney();
  };
  return { mode, persistence, service, controller, drafts: versionedDrafts, cards, shellState, reviewHistory, deleteAllData, replaceActiveReview };
}

export async function createJourneyRuntime({
  executionEnvironment,
  clipboard,
  createId,
  now,
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
      now
    });
  }
  return createNativeRuntime();
}

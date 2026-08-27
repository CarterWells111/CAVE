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

export type JourneyRuntimeMode = "expo-go-demo" | "native-secure";
export type JourneyRuntimePersistence = "memory-only" | "sqlcipher-secure-store";

export type JourneyRuntime = {
  mode: JourneyRuntimeMode;
  persistence: JourneyRuntimePersistence;
  service: DefaultJourneyApplicationService;
  controller: JourneyPageController;
  drafts: JourneyDraftRepository;
  cards: CommunicationCardRepository;
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
  clipboard,
  createId,
  now
}: ComposeDependencies): JourneyRuntime {
  const service = new DefaultJourneyApplicationService(drafts, { createId, now });
  const controller = new JourneyPageController({
    service,
    cards,
    clipboard,
    practice: new LocalPresetPracticeEngine(loadJourneyContentCatalog().practice),
    now
  });
  return { mode, persistence, service, controller, drafts, cards };
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

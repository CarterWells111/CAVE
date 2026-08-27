import * as ExpoClipboard from "expo-clipboard";
import Constants from "expo-constants";

import { createEncryptedDatabaseManager } from "../../../core/storage/database";
import type { ClipboardAdapter } from "../application/page-controllers";
import type { ExpoJourneyAdapters } from "../infrastructure/expo-journey-adapters";
import {
  SqlCommunicationCardRepository,
  SqlJourneyDraftRepository
} from "../infrastructure/sql-journey-draft-repository";
import {
  composeJourneyRuntime,
  createJourneyRuntime,
  type JourneyRuntime
} from "./journey-runtime";

export type NativeAdapterLoader = () => Promise<ExpoJourneyAdapters>;

type CompositionDependencies = {
  executionEnvironment: string;
  clipboard: ClipboardAdapter;
  createId(): string;
  now(): string;
  loadNativeAdapters: NativeAdapterLoader;
};

export function createComposedJourneyRuntime({
  executionEnvironment,
  clipboard,
  createId,
  now,
  loadNativeAdapters
}: CompositionDependencies): Promise<JourneyRuntime> {
  return createJourneyRuntime({
    executionEnvironment,
    clipboard,
    createId,
    now,
    createNativeRuntime: async () => {
      const adapters = await loadNativeAdapters();
      const database = createEncryptedDatabaseManager({
        native: adapters.native,
        files: adapters.files,
        secrets: adapters.secrets
      });
      return composeJourneyRuntime({
        mode: "native-secure",
        persistence: "sqlcipher-secure-store",
        drafts: new SqlJourneyDraftRepository(database),
        cards: new SqlCommunicationCardRepository(database),
        clipboard: adapters.clipboard,
        createId,
        now
      });
    }
  });
}

let idSequence = 0;

export function createExpoJourneyRuntime(): Promise<JourneyRuntime> {
  const clipboard: ClipboardAdapter = {
    async setStringAsync(value) {
      await ExpoClipboard.setStringAsync(value);
    }
  };
  return createComposedJourneyRuntime({
    executionEnvironment: Constants.executionEnvironment,
    clipboard,
    createId: () => `${Constants.sessionId}:journey:${++idSequence}`,
    now: () => new Date().toISOString(),
    loadNativeAdapters: async () => {
      const { createExpoJourneyAdapters } = await import("../infrastructure/expo-journey-adapters");
      return createExpoJourneyAdapters();
    }
  });
}

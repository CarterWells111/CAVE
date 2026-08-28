import * as ExpoClipboard from "expo-clipboard";
import Constants from "expo-constants";

import { createEncryptedDatabaseManager } from "../../../core/storage/database";
import { SqlAppearancePreferencesRepository } from "../../../core/design/appearance-preferences";
import { deleteAllData as deleteAllLocalData } from "../../../core/privacy/delete-all-data";
import type { ClipboardAdapter } from "../application/page-controllers";
import type { ExpoJourneyAdapters } from "../infrastructure/expo-journey-adapters";
import {
  SqlCommunicationCardRepository,
  SqlJourneyDraftRepository
} from "../infrastructure/sql-journey-draft-repository";
import { SqlAppShellStateRepository } from "../../shell/infrastructure/sql-app-shell-state-repository";
import {
  journeyDraftReviewPayloadCodec,
  SqlReviewHistoryRepository
} from "../../reviews/infrastructure/sql-review-history-repository";
import type { JourneyDraft } from "../domain/types";
import { SqlJourneyTransactionRepository } from "../infrastructure/sql-journey-transaction-repository";
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
      if (await adapters.secrets.hasPendingLocalDataDeletion()) {
        await deleteAllLocalData({ database, secrets: adapters.secrets });
      }
      const transactions = new SqlJourneyTransactionRepository(database);
      return composeJourneyRuntime({
        mode: "native-secure",
        persistence: "sqlcipher-secure-store",
        drafts: new SqlJourneyDraftRepository(database),
        cards: new SqlCommunicationCardRepository(database),
        shellState: new SqlAppShellStateRepository(database),
        reviewHistory: new SqlReviewHistoryRepository<JourneyDraft>(
          database,
          journeyDraftReviewPayloadCodec
        ),
        adultDeclaration: adapters.secrets,
        appearancePreferences: new SqlAppearancePreferencesRepository(database),
        saveVersionedDraft: (draft, active) => transactions.saveActive(draft, active),
        completeJourney: (transaction) => transactions.complete(transaction),
        branchReview: (transaction) => transactions.branch(transaction),
        deleteStorage: () => deleteAllLocalData({ database, secrets: adapters.secrets }),
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

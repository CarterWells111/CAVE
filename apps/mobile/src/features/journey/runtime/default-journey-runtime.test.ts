import type { DatabaseConnection } from "../../../core/storage/database";
import type { JournalRepository } from "../../journal/infrastructure/journal-repository";
import { InMemoryJournalRepository } from "../../journal/infrastructure/in-memory-journal-repository";
import {
  createExpoGoJournalRepository,
  type ExpoGoJournalDatabaseConnection,
} from "../../journal/infrastructure/expo-go-journal-repository";
import type { ExpoJourneyAdapters } from "../infrastructure/expo-journey-adapters";
import {
  createComposedJourneyRuntime,
  type NativeAdapterLoader
} from "./default-journey-runtime";

const clipboard = { setStringAsync: jest.fn(async () => undefined) };

const expoGoExecAsync = jest.fn(async (sql: string) => { void sql; });
const expoGoRunAsync = jest.fn(async (...parameters: [string, ...unknown[]]) => {
  void parameters;
  return { changes: 0 };
});
const expoGoGetAllAsync = jest.fn(async (...parameters: [string, ...unknown[]]) => {
  void parameters;
  return [];
});
const expoGoGetFirstAsync = jest.fn(async (sql: string, ...parameters: unknown[]) => {
  void parameters;
  return sql === "PRAGMA user_version" ? { user_version: 0 } : null;
});
const expoGoDatabase: ExpoGoJournalDatabaseConnection = {
  closeAsync: jest.fn(async () => undefined),
  execAsync: expoGoExecAsync,
  runAsync: expoGoRunAsync,
  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    return await expoGoGetAllAsync(sql, ...params) as T[];
  },
  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    return await expoGoGetFirstAsync(sql, ...params) as T | null;
  },
};
const mockOpenDatabaseAsync = jest.fn(async () => expoGoDatabase);

type DesiredCompositionDependencies = Parameters<typeof createComposedJourneyRuntime>[0] & {
  createExpoGoJournalRepository?: () => Promise<JournalRepository>;
};

function nativeAdapters({ deletionPending = false } = {}): ExpoJourneyAdapters {
  let pending = deletionPending;
  const database = {
    execAsync: jest.fn(async () => undefined),
    runAsync: jest.fn(async () => ({ changes: 0 })),
    getAllAsync: jest.fn(async <T,>() => [] as T[]),
    getFirstAsync: jest.fn(async <T,>(sql: string) => (sql === "PRAGMA user_version"
      ? { user_version: 2 } as T
      : null)),
    closeAsync: jest.fn(async () => undefined)
  } as unknown as DatabaseConnection;
  return {
    native: { openDatabaseAsync: jest.fn(async () => database) },
    files: {
      databaseExists: jest.fn(async () => true),
      removeDatabaseFiles: jest.fn(async () => undefined)
    },
    secrets: {
      getDatabaseKey: jest.fn(async () => "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="),
      getOrCreateDatabaseKey: jest.fn(async () => "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="),
      getOrCreateInstallationToken: jest.fn(async () => "token"),
      deleteDatabaseKey: jest.fn(async () => undefined),
      hasAdultDeclaration: jest.fn(async () => true),
      recordAdultDeclaration: jest.fn(async () => undefined),
      deleteAdultDeclaration: jest.fn(async () => undefined),
      hasPendingLocalDataDeletion: jest.fn(async () => pending),
      recordPendingLocalDataDeletion: jest.fn(async () => { pending = true; }),
      clearPendingLocalDataDeletion: jest.fn(async () => { pending = false; }),
      deleteInstallationToken: jest.fn(async () => undefined),
      deleteAuthSession: jest.fn(async () => undefined),
      deleteAllSecrets: jest.fn(async () => undefined)
    },
    clipboard
  };
}

test("Expo Go composition opens only the dedicated plaintext journal database", async () => {
  const loadNativeAdapters = jest.fn<ReturnType<NativeAdapterLoader>, []>();

  const runtime = await createComposedJourneyRuntime({
    executionEnvironment: "storeClient",
    clipboard,
    createId: () => "demo-journey",
    now: () => "2026-08-27T12:00:00.000Z",
    loadNativeAdapters,
    createExpoGoJournalRepository: async () => createExpoGoJournalRepository({
      openDatabaseAsync: mockOpenDatabaseAsync,
    }),
  });

  expect(runtime.persistence).toBe("memory-only");
  expect(runtime.journalPersistence).toBe("plaintext-sqlite");
  expect(loadNativeAdapters).not.toHaveBeenCalled();

  await runtime.createJournalService("account-a").listRecords();

  expect(mockOpenDatabaseAsync).toHaveBeenCalledWith("cave-expo-go-journal.db");
  expect(expoGoExecAsync).toHaveBeenCalledWith("PRAGMA foreign_keys = ON");
  expect(expoGoExecAsync).toHaveBeenCalledWith("PRAGMA journal_mode = WAL");
  expect(expoGoExecAsync).toHaveBeenCalledWith("PRAGMA secure_delete = ON");
  expect(expoGoExecAsync).toHaveBeenCalledWith("BEGIN IMMEDIATE");
  expect(expoGoExecAsync).toHaveBeenCalledWith("COMMIT");
  const schema = expoGoExecAsync.mock.calls
    .map(([sql]) => sql)
    .find((sql) => sql.includes("CREATE TABLE IF NOT EXISTS journal_records")) ?? "";
  expect(schema).toContain("CREATE TABLE IF NOT EXISTS journal_entries");
  expect(schema).toContain("CREATE TABLE IF NOT EXISTS journal_period_reviews");
  expect(schema).not.toMatch(/journey_drafts|journey_cards|privacy_settings/u);
  expect(expoGoExecAsync).toHaveBeenCalledWith("PRAGMA user_version = 2");
});

test("Expo Go runtime recreation uses the same injected local journal store", async () => {
  const repository = new InMemoryJournalRepository();
  const dependencies = {
    executionEnvironment: "storeClient",
    clipboard,
    createId: () => "persisted-record",
    now: () => "2026-08-27T12:00:00.000Z",
    loadNativeAdapters: jest.fn<ReturnType<NativeAdapterLoader>, []>(),
    createExpoGoJournalRepository: async () => repository,
  } as DesiredCompositionDependencies;

  const first = await createComposedJourneyRuntime(dependencies);
  await first.createJournalService("account-a").createRecord({
    title: "保留的手记",
    occurredAt: "2026-08-27",
    highlight: { kind: "feeling", text: "安心" },
  });
  const reopened = await createComposedJourneyRuntime(dependencies);

  await expect(reopened.createJournalService("account-a").listRecords()).resolves.toHaveLength(1);
  await expect(reopened.createJournalService("account-b").listRecords()).resolves.toEqual([]);
  expect(dependencies.loadNativeAdapters).not.toHaveBeenCalled();
});

test("Development and Preview compose SQLCipher repositories and propagate adapter failures", async () => {
  const adapters = nativeAdapters();
  const loadNativeAdapters = jest.fn(async () => adapters);
  const accountProfiles = { clearAll: jest.fn(async () => undefined) };

  const runtime = await createComposedJourneyRuntime({
    executionEnvironment: "standalone",
    clipboard,
    createId: () => "native-journey",
    now: () => "2026-08-27T12:00:00.000Z",
    loadNativeAdapters,
    accountProfiles,
  });

  expect(runtime.persistence).toBe("sqlcipher-secure-store");
  expect(runtime.journalPersistence).toBe("sqlcipher");
  await expect(runtime.service.initialize()).resolves.toBe("ready");
  expect(adapters.native.openDatabaseAsync).toHaveBeenCalledWith("cave.db");
  await runtime.deleteAllData();
  expect(accountProfiles.clearAll).toHaveBeenCalledTimes(1);

  const failure = new Error("native-adapters-unavailable");
  await expect(createComposedJourneyRuntime({
    executionEnvironment: "bare",
    clipboard,
    createId: () => "unused",
    now: () => "2026-08-27T12:00:00.000Z",
    loadNativeAdapters: jest.fn(async () => { throw failure; })
  })).rejects.toBe(failure);
});

test("resumes a pending local-data deletion before exposing the native runtime", async () => {
  const adapters = nativeAdapters({ deletionPending: true });
  const accountProfiles = { clearAll: jest.fn(async () => undefined) };

  const runtime = await createComposedJourneyRuntime({
    executionEnvironment: "standalone",
    clipboard,
    createId: () => "native-after-cleanup",
    now: () => "2026-08-28T12:00:00.000Z",
    loadNativeAdapters: async () => adapters,
    accountProfiles,
  });

  expect(runtime.persistence).toBe("sqlcipher-secure-store");
  expect(adapters.secrets.deleteAdultDeclaration).toHaveBeenCalledTimes(1);
  expect(adapters.secrets.deleteDatabaseKey).toHaveBeenCalledTimes(1);
  expect(adapters.files.removeDatabaseFiles).toHaveBeenCalledTimes(1);
  expect(accountProfiles.clearAll).toHaveBeenCalledTimes(1);
  expect(adapters.secrets.deleteInstallationToken).toHaveBeenCalledTimes(1);
  expect(adapters.secrets.clearPendingLocalDataDeletion).toHaveBeenCalledTimes(1);
  expect(adapters.native.openDatabaseAsync).not.toHaveBeenCalled();
});

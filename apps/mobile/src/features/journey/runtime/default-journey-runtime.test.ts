import type { DatabaseConnection } from "../../../core/storage/database";
import type { ExpoJourneyAdapters } from "../infrastructure/expo-journey-adapters";
import {
  createComposedJourneyRuntime,
  type NativeAdapterLoader
} from "./default-journey-runtime";

const clipboard = { setStringAsync: jest.fn(async () => undefined) };

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

test("Expo Go composition returns memory-only before loading secure native adapters", async () => {
  const loadNativeAdapters = jest.fn<ReturnType<NativeAdapterLoader>, []>();

  const runtime = await createComposedJourneyRuntime({
    executionEnvironment: "storeClient",
    clipboard,
    createId: () => "demo-journey",
    now: () => "2026-08-27T12:00:00.000Z",
    loadNativeAdapters
  });

  expect(runtime.persistence).toBe("memory-only");
  expect(loadNativeAdapters).not.toHaveBeenCalled();
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

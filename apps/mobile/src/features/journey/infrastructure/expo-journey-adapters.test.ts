import { SECRET_NAMES } from "../../../core/storage/key-store";
import { createExpoJourneyAdapters } from "./expo-journey-adapters";

function expoFileSystemError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

function makeDatabase() {
  return {
    execAsync: jest.fn(async () => undefined),
    runAsync: jest.fn(async () => ({ changes: 0 })),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async () => null),
    closeAsync: jest.fn(async () => undefined)
  };
}

function makeModules(options: {
  databaseDirectory?: string;
  existingFiles?: string[];
  deleteErrors?: Record<string, Error>;
  disappearBeforeDeleteError?: string[];
} = {}) {
  const database = makeDatabase();
  const constructedFileUris: string[][] = [];
  const deletedFiles: string[] = [];
  const deleteAttempts: string[] = [];
  const existingFiles = new Set(options.existingFiles ?? []);

  class File {
    private readonly name: string;

    constructor(...uris: string[]) {
      constructedFileUris.push(uris);
      this.name = uris.at(-1) ?? "";
    }

    get exists() {
      return existingFiles.has(this.name);
    }

    delete() {
      deleteAttempts.push(this.name);
      const error = options.deleteErrors?.[this.name];
      if (error !== undefined) {
        if (options.disappearBeforeDeleteError?.includes(this.name)) {
          existingFiles.delete(this.name);
        }
        throw error;
      }
      if (!existingFiles.has(this.name)) {
        throw expoFileSystemError(
          "ERR_UNABLE_TO_DELETE",
          "Call to function 'FileSystemFile.delete' has been rejected.\n"
            + "→ Caused by: Unable to delete file or directory: path does not exist"
        );
      }
      deletedFiles.push(this.name);
      existingFiles.delete(this.name);
    }
  }

  const sqlite = {
    defaultDatabaseDirectory: options.databaseDirectory ?? "/data/user/0/app/files/SQLite",
    openDatabaseAsync: jest.fn(async () => database),
    deleteDatabaseAsync: jest.fn(async () => undefined)
  };
  const secureStore = {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 314,
    getItemAsync: jest.fn(async () => null),
    setItemAsync: jest.fn(async () => undefined),
    deleteItemAsync: jest.fn(async () => undefined)
  };
  const clipboard = {
    setStringAsync: jest.fn(async () => undefined)
  };
  const randomBytes = jest.fn((length: number) => new Uint8Array(length).fill(7));

  return {
    database,
    constructedFileUris,
    deleteAttempts,
    deletedFiles,
    dependencies: { sqlite, fileSystem: { File }, secureStore, clipboard, randomBytes },
    sqlite,
    secureStore,
    clipboard,
    randomBytes
  };
}

describe("Expo journey adapters", () => {
  test("opens SQLite through the injected SDK module", async () => {
    const harness = makeModules();
    const adapters = createExpoJourneyAdapters(harness.dependencies);

    await expect(adapters.native.openDatabaseAsync("cave.db")).resolves.toBe(harness.database);
    expect(harness.sqlite.openDatabaseAsync).toHaveBeenCalledWith("cave.db");
  });

  test.each([
    ["Android bare path", "/data/user/0/app/files/SQLite", "file:///data/user/0/app/files/SQLite"],
    [
      "iOS bare path",
      "/var/mobile/Containers/Data/Application/UUID/Documents/SQLite",
      "file:///var/mobile/Containers/Data/Application/UUID/Documents/SQLite"
    ],
    ["Windows bare path", "C:\\Users\\App\\SQLite", "file:///C:/Users/App/SQLite"],
    ["existing file URI", "file:///data/user/0/app/files/SQLite", "file:///data/user/0/app/files/SQLite"]
  ])("normalizes the SQLite directory for Expo FileSystem (%s)", async (_label, directory, expected) => {
    const harness = makeModules({ databaseDirectory: directory, existingFiles: ["cave.db"] });
    const adapters = createExpoJourneyAdapters(harness.dependencies);

    expect(adapters.files.coordinationKey).toBe(expected);
    await expect(adapters.files.databaseExists("cave.db")).resolves.toBe(true);
    expect(harness.constructedFileUris).toEqual([[expected, "cave.db"]]);
  });

  test("removes the main database and SQLite sidecars", async () => {
    const harness = makeModules({ existingFiles: ["cave.db", "cave.db-wal", "cave.db-shm"] });
    const adapters = createExpoJourneyAdapters(harness.dependencies);

    await adapters.files.removeDatabaseFiles("cave.db");

    expect(harness.deletedFiles).toEqual(["cave.db", "cave.db-wal", "cave.db-shm"]);
    expect(harness.sqlite.deleteDatabaseAsync).not.toHaveBeenCalled();
  });

  test("is idempotent when a stale key exists without any database files", async () => {
    const harness = makeModules();
    const adapters = createExpoJourneyAdapters(harness.dependencies);

    await adapters.files.removeDatabaseFiles("cave.db");
    await adapters.files.removeDatabaseFiles("cave.db");

    expect(harness.deletedFiles).toEqual([]);
    expect(harness.deleteAttempts).toEqual([
      "cave.db", "cave.db-wal", "cave.db-shm",
      "cave.db", "cave.db-wal", "cave.db-shm"
    ]);
  });

  test("removes orphaned WAL and SHM files when the main database is absent", async () => {
    const harness = makeModules({ existingFiles: ["cave.db-wal", "cave.db-shm"] });
    const adapters = createExpoJourneyAdapters(harness.dependencies);

    await adapters.files.removeDatabaseFiles("cave.db");

    expect(harness.deletedFiles).toEqual(["cave.db-wal", "cave.db-shm"]);
  });

  test("tolerates a coded not-found failure when a file disappears during delete", async () => {
    const missing = expoFileSystemError(
      "ERR_UNABLE_TO_DELETE",
      "Unable to delete file or directory: uri 'file:///sqlite/cave.db' does not exist"
    );
    const harness = makeModules({
      existingFiles: ["cave.db"],
      deleteErrors: { "cave.db": missing },
      disappearBeforeDeleteError: ["cave.db"]
    });
    const adapters = createExpoJourneyAdapters(harness.dependencies);

    await expect(adapters.files.removeDatabaseFiles("cave.db")).resolves.toBeUndefined();
  });

  test("propagates a permission error even when File.exists is false", async () => {
    const denied = expoFileSystemError(
      "ERR_INVALID_PERMISSION",
      "Missing 'WRITE' permission for accessing the file."
    );
    const harness = makeModules({
      deleteErrors: { "cave.db": denied }
    });
    const adapters = createExpoJourneyAdapters(harness.dependencies);

    await expect(adapters.files.removeDatabaseFiles("cave.db")).rejects.toBe(denied);
    expect(harness.deleteAttempts).toEqual(["cave.db"]);
  });

  test("propagates delete failures while the file still exists", async () => {
    const denied = new Error("permission denied");
    const harness = makeModules({
      existingFiles: ["cave.db"],
      deleteErrors: { "cave.db": denied }
    });
    const adapters = createExpoJourneyAdapters(harness.dependencies);

    await expect(adapters.files.removeDatabaseFiles("cave.db")).rejects.toBe(denied);
  });

  test("stores generated secrets with device-only SecureStore accessibility", async () => {
    const harness = makeModules();
    const adapters = createExpoJourneyAdapters(harness.dependencies);

    const key = await adapters.secrets.getOrCreateDatabaseKey();

    expect(harness.randomBytes).toHaveBeenCalledWith(32);
    expect(harness.secureStore.setItemAsync).toHaveBeenCalledWith(
      SECRET_NAMES.databaseKey,
      key,
      { keychainAccessible: 314 }
    );
  });

  test("forwards clipboard writes and their failures without fallback", async () => {
    const harness = makeModules();
    const adapters = createExpoJourneyAdapters(harness.dependencies);
    const denied = new Error("clipboard-denied");

    await adapters.clipboard.setStringAsync("communication card");
    harness.clipboard.setStringAsync.mockRejectedValueOnce(denied);

    expect(harness.clipboard.setStringAsync).toHaveBeenCalledWith("communication card");
    await expect(adapters.clipboard.setStringAsync("retry")).rejects.toBe(denied);
  });

  test("propagates native storage failures without substituting another adapter", async () => {
    const harness = makeModules();
    const adapters = createExpoJourneyAdapters(harness.dependencies);
    const nativeFailure = new Error("native-storage-unavailable");
    harness.sqlite.openDatabaseAsync.mockRejectedValueOnce(nativeFailure);

    await expect(adapters.native.openDatabaseAsync("cave.db")).rejects.toBe(nativeFailure);
  });
});

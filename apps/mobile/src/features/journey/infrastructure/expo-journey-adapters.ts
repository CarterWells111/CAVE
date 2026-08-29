import * as ExpoClipboard from "expo-clipboard";
import * as ExpoCrypto from "expo-crypto";
import * as ExpoFileSystem from "expo-file-system";
import * as ExpoSecureStore from "expo-secure-store";
import * as ExpoSQLite from "expo-sqlite";

import type {
  DatabaseConnection,
  DatabaseFileAdapter,
  NativeDatabaseAdapter
} from "../../../core/storage/database";
import {
  createExpoSecureStoreAdapter,
  createSecretRepository,
  type DatabaseSecretRepository
} from "../../../core/storage/key-store";
import type { ClipboardAdapter } from "../application/page-controllers";

type ExpoSQLiteModule = {
  defaultDatabaseDirectory: string | null;
  openDatabaseAsync(name: string): Promise<unknown>;
};

type ExpoFileSystemModule = {
  File: new (...uris: string[]) => {
    readonly exists: boolean;
    delete(): void;
  };
};

type ExpoSecureStoreModule = {
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: unknown;
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(
    key: string,
    value: string,
    options: { keychainAccessible: unknown }
  ): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

type ExpoClipboardModule = {
  setStringAsync(value: string): Promise<unknown>;
};

export type ExpoJourneyAdapterDependencies = {
  sqlite: ExpoSQLiteModule;
  fileSystem: ExpoFileSystemModule;
  secureStore: ExpoSecureStoreModule;
  clipboard: ExpoClipboardModule;
  randomBytes(length: number): Uint8Array | Promise<Uint8Array>;
};

export type ExpoJourneyAdapters = {
  native: NativeDatabaseAdapter;
  files: DatabaseFileAdapter;
  secrets: DatabaseSecretRepository;
  clipboard: ClipboardAdapter;
};

const defaultDependencies: ExpoJourneyAdapterDependencies = {
  sqlite: ExpoSQLite,
  fileSystem: ExpoFileSystem,
  secureStore: ExpoSecureStore as unknown as ExpoSecureStoreModule,
  clipboard: ExpoClipboard,
  randomBytes: ExpoCrypto.getRandomBytes
};

function encodeBareFilePath(path: string): string {
  return path
    .split("/")
    .map((segment, index) => index === 0 && /^[A-Za-z]:$/u.test(segment)
      ? segment
      : encodeURIComponent(segment))
    .join("/");
}

function toFileUri(path: string): string {
  if (/^file:\/\//iu.test(path)) return path;

  const normalized = path.replace(/\\/gu, "/");
  const encoded = encodeBareFilePath(normalized);
  if (/^[A-Za-z]:\//u.test(normalized)) return `file:///${encoded}`;
  if (normalized.startsWith("//")) return `file:${encoded}`;
  if (normalized.startsWith("/")) return `file://${encoded}`;
  throw new Error("Expo SQLite default database directory must be an absolute path");
}

function isExpoFileNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === "ERR_UNABLE_TO_DELETE"
    && typeof candidate.message === "string"
    && /Unable to delete file or directory: (?:path|uri '[^'\r\n]+') does not exist$/u
      .test(candidate.message);
}

export function createExpoJourneyAdapters(
  overrides: Partial<ExpoJourneyAdapterDependencies> = {}
): ExpoJourneyAdapters {
  const dependencies = { ...defaultDependencies, ...overrides };

  function databaseDirectoryUri(): string {
    const directory = dependencies.sqlite.defaultDatabaseDirectory;
    if (directory === null) {
      throw new Error("Expo SQLite default database directory is unavailable");
    }
    return toFileUri(directory);
  }

  function databaseFile(name: string) {
    return new dependencies.fileSystem.File(databaseDirectoryUri(), name);
  }

  function deleteIfPresent(name: string): void {
    const file = databaseFile(name);
    try {
      file.delete();
    } catch (error) {
      if (!isExpoFileNotFoundError(error)) throw error;
    }
  }

  return {
    native: {
      async openDatabaseAsync(name) {
        return await dependencies.sqlite.openDatabaseAsync(name) as DatabaseConnection;
      }
    },
    files: {
      get coordinationKey() {
        return databaseDirectoryUri();
      },
      async databaseExists(name) {
        return databaseFile(name).exists;
      },
      async removeDatabaseFiles(name) {
        deleteIfPresent(name);
        deleteIfPresent(`${name}-wal`);
        deleteIfPresent(`${name}-shm`);
      }
    },
    secrets: createSecretRepository({
      secureStore: createExpoSecureStoreAdapter(dependencies.secureStore),
      randomBytes: dependencies.randomBytes
    }),
    clipboard: {
      async setStringAsync(value) {
        await dependencies.clipboard.setStringAsync(value);
      }
    }
  };
}

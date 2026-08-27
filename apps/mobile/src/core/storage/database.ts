import type { DatabaseSecretRepository } from "./key-store";
import { CURRENT_SCHEMA_VERSION, SCHEMA_V1, SCHEMA_V2 } from "./migrations";

export interface DatabaseConnection {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: unknown[]): Promise<{ changes: number }>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
  closeAsync(): Promise<void>;
}

export interface NativeDatabaseAdapter {
  openDatabaseAsync(name: string): Promise<DatabaseConnection>;
}

export interface DatabaseFileAdapter {
  databaseExists(name: string): Promise<boolean>;
  removeDatabaseFiles(name: string): Promise<void>;
}

export interface EncryptedDatabaseManager {
  initialize(): Promise<DatabaseConnection>;
  close(): Promise<void>;
  removeDatabaseFiles(): Promise<void>;
}

type Dependencies = {
  native: NativeDatabaseAdapter;
  files: DatabaseFileAdapter;
  secrets: DatabaseSecretRepository;
  databaseName?: string;
};

type UserVersionRow = { user_version: number };

export class InvalidDatabaseKeyError extends Error {
  constructor() {
    super("Invalid encoded database key");
    this.name = "InvalidDatabaseKeyError";
  }
}

export class UnsupportedDatabaseVersionError extends Error {
  constructor(version: number) {
    super(`Unsupported database version: ${version}`);
    this.name = "UnsupportedDatabaseVersionError";
  }
}

function isSqlCipherKeyMismatch(error: unknown): boolean {
  if (error instanceof InvalidDatabaseKeyError) return true;
  if (!(error instanceof Error)) return false;
  return /(?:file is encrypted|file is not a database|^not a database$|wrong (?:database )?key|sqlcipher[^\n]*key)/iu
    .test(error.message);
}

export function createEncryptedDatabaseManager({
  native,
  files,
  secrets,
  databaseName = "cave.db"
}: Dependencies): EncryptedDatabaseManager {
  let connection: DatabaseConnection | null = null;

  async function clearMismatchedState(key: string | null) {
    await files.removeDatabaseFiles(databaseName);
    if (key !== null) await secrets.deleteDatabaseKey();
  }

  async function openAndMigrate(key: string): Promise<DatabaseConnection> {
    if (!/^[A-Za-z0-9+/]{43}=$/u.test(key)) {
      throw new InvalidDatabaseKeyError();
    }
    const opened = await native.openDatabaseAsync(databaseName);
    try {
      await opened.execAsync(`PRAGMA key = '${key}'`);
      await opened.execAsync("PRAGMA foreign_keys = ON");
      await opened.execAsync("PRAGMA journal_mode = WAL");
      const version = await opened.getFirstAsync<UserVersionRow>("PRAGMA user_version");
      const currentVersion = version?.user_version ?? 0;
      if (currentVersion > CURRENT_SCHEMA_VERSION) {
        throw new UnsupportedDatabaseVersionError(currentVersion);
      }
      if (currentVersion < 1) {
        await applyMigration(opened, SCHEMA_V1, 1);
      }
      if (currentVersion < CURRENT_SCHEMA_VERSION) {
        await applyMigration(opened, SCHEMA_V2, 2);
      }
      return opened;
    } catch (error) {
      await opened.closeAsync();
      throw error;
    }
  }

  async function initialize(): Promise<DatabaseConnection> {
    if (connection !== null) return connection;

    const databaseExists = await files.databaseExists(databaseName);
    const existingKey = await secrets.getDatabaseKey();
    if (databaseExists !== (existingKey !== null)) {
      await clearMismatchedState(existingKey);
    }

    const key = await secrets.getOrCreateDatabaseKey();
    try {
      connection = await openAndMigrate(key);
    } catch (error) {
      connection = null;
      if (!isSqlCipherKeyMismatch(error)) throw error;
      await files.removeDatabaseFiles(databaseName);
      await secrets.deleteDatabaseKey();
      const replacementKey = await secrets.getOrCreateDatabaseKey();
      connection = await openAndMigrate(replacementKey);
    }
    return connection;
  }

  return {
    initialize,
    async close() {
      if (connection === null) return;
      await connection.closeAsync();
      connection = null;
    },
    removeDatabaseFiles: () => files.removeDatabaseFiles(databaseName)
  };
}

async function applyMigration(
  connection: DatabaseConnection,
  schema: string,
  version: number
): Promise<void> {
  await connection.execAsync("BEGIN IMMEDIATE");
  try {
    await connection.execAsync(schema);
    await connection.execAsync(`PRAGMA user_version = ${version}`);
    await connection.execAsync("COMMIT");
  } catch (error) {
    await connection.execAsync("ROLLBACK");
    throw error;
  }
}

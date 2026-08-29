import * as ExpoSQLite from "expo-sqlite";

import type {
  DatabaseConnection,
  DatabaseTransactionConnection,
  ManagedDatabaseConnection,
} from "../../../core/storage/database";
import { SCHEMA_V11 } from "../../../core/storage/migrations";
import { SqlJournalRepository, type JournalDatabaseManager } from "./sql-journal-repository";

export const EXPO_GO_JOURNAL_DATABASE_NAME = "cave-expo-go-journal.db";
export const EXPO_GO_JOURNAL_SCHEMA_VERSION = 2;

const EXPO_GO_JOURNAL_SCHEMA_V1 = `${SCHEMA_V11}
CREATE INDEX IF NOT EXISTS journal_records_owner_date_idx
  ON journal_records(owner_account_id, occurred_at DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS journal_period_reviews_owner_created_idx
  ON journal_period_reviews(owner_account_id, created_at DESC);`;

const EXPO_GO_JOURNAL_SCHEMA_V2 = `
CREATE TABLE IF NOT EXISTS journal_storage_state (
  singleton_id INTEGER PRIMARY KEY NOT NULL CHECK (singleton_id = 1),
  cleanup_pending INTEGER NOT NULL CHECK (cleanup_pending IN (0, 1))
);
INSERT INTO journal_storage_state (singleton_id, cleanup_pending)
VALUES (1, 0)
ON CONFLICT(singleton_id) DO NOTHING;
CREATE TABLE IF NOT EXISTS journal_cleared_owners (
  owner_account_id TEXT PRIMARY KEY NOT NULL
);`;

type UserVersionRow = { user_version: number };
type CleanupStateRow = { cleanup_pending: number };
type WalCheckpointRow = { busy: number; log: number; checkpointed: number };

export type ExpoGoJournalDatabaseConnection = DatabaseConnection;

export type ExpoGoJournalDatabaseDependencies = {
  openDatabaseAsync(name: string): Promise<ExpoGoJournalDatabaseConnection>;
};

const migrations = [
  { version: 1, schema: EXPO_GO_JOURNAL_SCHEMA_V1 },
  { version: 2, schema: EXPO_GO_JOURNAL_SCHEMA_V2 },
] as const;

function assertMigrationRegistry(): void {
  if (migrations.length !== EXPO_GO_JOURNAL_SCHEMA_VERSION) {
    throw new Error("Expo Go journal migration registry is incomplete");
  }
  for (const [index, migration] of migrations.entries()) {
    if (migration.version !== index + 1) {
      throw new Error("Expo Go journal migrations must be contiguous and start at 1");
    }
  }
}

assertMigrationRegistry();

export class UnsupportedExpoGoJournalDatabaseVersionError extends Error {
  constructor(version: number) {
    super(`Unsupported Expo Go journal database version: ${version}`);
    this.name = "UnsupportedExpoGoJournalDatabaseVersionError";
  }
}

class ExpoGoJournalDeletionCleanupPendingError extends Error {
  readonly cleanupPending = true;
  override readonly cause?: unknown;

  constructor(
    cause: unknown,
    readonly ownerDeletionCommitted = false,
  ) {
    super(cause instanceof Error ? cause.message : "journal-deletion-cleanup-pending");
    this.name = "ExpoGoJournalDeletionCleanupPendingError";
    this.cause = cause;
  }
}

const defaultDependencies: ExpoGoJournalDatabaseDependencies = {
  async openDatabaseAsync(name) {
    return await ExpoSQLite.openDatabaseAsync(name) as unknown as ExpoGoJournalDatabaseConnection;
  },
};

const sharedManagers = new WeakMap<
  ExpoGoJournalDatabaseDependencies,
  JournalDatabaseManager
>();

export function createExpoGoJournalDatabaseManager(
  dependencies: ExpoGoJournalDatabaseDependencies = defaultDependencies,
): JournalDatabaseManager {
  let initialization: Promise<ExpoGoJournalDatabaseConnection> | null = null;
  let operationQueue: Promise<void> = Promise.resolve();

  function enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
    const scheduled = operationQueue.then(operation, operation);
    operationQueue = scheduled.then(() => undefined, () => undefined);
    return scheduled;
  }

  function preserveSecondaryFailure(
    primaryError: unknown,
    property: "closeError" | "rollbackError",
    secondaryError: unknown,
  ): void {
    if (primaryError instanceof Error) {
      Object.defineProperty(primaryError, property, { value: secondaryError });
    }
  }

  async function checkpointPendingDeletion(
    database: ExpoGoJournalDatabaseConnection,
    ownerDeletionCommitted = false,
  ): Promise<boolean> {
    const state = await database.getFirstAsync<CleanupStateRow>(
      "SELECT cleanup_pending FROM journal_storage_state WHERE singleton_id=1",
    );
    if (state?.cleanup_pending !== 1) return false;
    try {
      const result = await database.getFirstAsync<WalCheckpointRow>(
        "PRAGMA wal_checkpoint(TRUNCATE)",
      );
      if (result === null || result.busy !== 0 || result.log !== 0) {
        throw new Error("journal-wal-checkpoint-busy");
      }
      await database.runAsync(
        "UPDATE journal_storage_state SET cleanup_pending=0 WHERE singleton_id=1",
      );
      return true;
    } catch (error) {
      throw new ExpoGoJournalDeletionCleanupPendingError(
        error,
        ownerDeletionCommitted,
      );
    }
  }

  async function openAndMigrate(): Promise<ExpoGoJournalDatabaseConnection> {
    const database = await dependencies.openDatabaseAsync(EXPO_GO_JOURNAL_DATABASE_NAME);
    try {
      await database.execAsync("PRAGMA foreign_keys = ON");
      await database.execAsync("PRAGMA secure_delete = ON");
      await database.execAsync("PRAGMA journal_mode = WAL");
      await database.execAsync("BEGIN IMMEDIATE");
      try {
        const row = await database.getFirstAsync<UserVersionRow>("PRAGMA user_version");
        let version = row?.user_version ?? 0;
        if (version > EXPO_GO_JOURNAL_SCHEMA_VERSION) {
          throw new UnsupportedExpoGoJournalDatabaseVersionError(version);
        }
        for (const migration of migrations) {
          if (version >= migration.version) continue;
          await database.execAsync(migration.schema);
          await database.execAsync(`PRAGMA user_version = ${migration.version}`);
          version = migration.version;
        }
        await database.execAsync("COMMIT");
      } catch (error) {
        try {
          await database.execAsync("ROLLBACK");
        } catch (rollbackError) {
          preserveSecondaryFailure(error, "rollbackError", rollbackError);
        }
        throw error;
      }
      try {
        await checkpointPendingDeletion(database);
      } catch {
        // The durable marker keeps cleanup pending for the next explicit retry.
      }
      return database;
    } catch (error) {
      try {
        await database.closeAsync();
      } catch (closeError) {
        preserveSecondaryFailure(error, "closeError", closeError);
      }
      throw error;
    }
  }

  async function initializeDatabase(): Promise<ExpoGoJournalDatabaseConnection> {
    if (initialization === null) {
      const attempt = openAndMigrate();
      initialization = attempt;
      void attempt.catch(() => {
        if (initialization === attempt) initialization = null;
      });
    }
    return await initialization;
  }

  const managedConnection: ManagedDatabaseConnection = {
    runAsync(sql, ...params) {
      return enqueueOperation(async () => (
        await initializeDatabase()
      ).runAsync(sql, ...params));
    },
    getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
      return enqueueOperation(async () => (
        await initializeDatabase()
      ).getAllAsync<T>(sql, ...params));
    },
    getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
      return enqueueOperation(async () => (
        await initializeDatabase()
      ).getFirstAsync<T>(sql, ...params));
    },
  };

  return {
    async initialize() {
      await initializeDatabase();
      return managedConnection;
    },
    async withTransaction<T>(
      operation: (connection: DatabaseTransactionConnection) => Promise<T>
    ): Promise<T> {
      return await enqueueOperation(async () => {
        const database = await initializeDatabase();
        await database.execAsync("BEGIN IMMEDIATE");
        try {
          const result = await operation(database);
          await database.execAsync("COMMIT");
          return result;
        } catch (error) {
          try {
            await database.execAsync("ROLLBACK");
          } catch (rollbackError) {
            preserveSecondaryFailure(error, "rollbackError", rollbackError);
          }
          throw error;
        }
      });
    },
    async markDeletionCleanupPending(
      connection: DatabaseTransactionConnection,
    ): Promise<void> {
      await connection.runAsync(
        "UPDATE journal_storage_state SET cleanup_pending=1 WHERE singleton_id=1",
      );
    },
    async markOwnerDeletionCleanupPending(
      connection: DatabaseTransactionConnection,
      ownerAccountId: string,
    ): Promise<void> {
      await connection.runAsync(
        "UPDATE journal_storage_state SET cleanup_pending=1 WHERE singleton_id=1",
      );
      await connection.runAsync(
        "INSERT INTO journal_cleared_owners (owner_account_id) VALUES (?) ON CONFLICT(owner_account_id) DO NOTHING",
        ownerAccountId,
      );
    },
    async clearOwnerDeletionMarker(
      connection: DatabaseTransactionConnection,
      ownerAccountId: string,
    ): Promise<void> {
      await connection.runAsync(
        "DELETE FROM journal_cleared_owners WHERE owner_account_id=?",
        ownerAccountId,
      );
    },
    async checkpointAfterDeletion(): Promise<void> {
      await enqueueOperation(async () => {
        const database = await initializeDatabase();
        await checkpointPendingDeletion(database);
      });
    },
    async ensureDeletionCleanup(ownerAccountId: string): Promise<boolean> {
      return await enqueueOperation(async () => {
        const database = await initializeDatabase();
        const cleared = await database.getFirstAsync<{ owner_account_id: string }>(
          "SELECT owner_account_id FROM journal_cleared_owners WHERE owner_account_id=?",
          ownerAccountId,
        );
        await checkpointPendingDeletion(database, cleared !== null);
        return cleared !== null;
      });
    },
  };
}

export function createExpoGoJournalRepository(
  dependencies: ExpoGoJournalDatabaseDependencies = defaultDependencies,
): SqlJournalRepository {
  let manager = sharedManagers.get(dependencies);
  if (manager === undefined) {
    manager = createExpoGoJournalDatabaseManager(dependencies);
    sharedManagers.set(dependencies, manager);
  }
  return new SqlJournalRepository(manager);
}

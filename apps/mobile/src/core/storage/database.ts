import type { DatabaseSecretRepository } from "./key-store";
import {
  DATABASE_MIGRATIONS,
  CURRENT_SCHEMA_VERSION
} from "./migrations";

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

export type ManagedDatabaseConnection = Pick<
DatabaseConnection,
"runAsync" | "getAllAsync" | "getFirstAsync"
>;

export interface DatabaseFileAdapter {
  coordinationKey?: string;
  databaseExists(name: string): Promise<boolean>;
  removeDatabaseFiles(name: string): Promise<void>;
}

export interface EncryptedDatabaseManager {
  initialize(): Promise<ManagedDatabaseConnection>;
  close(): Promise<void>;
  removeDatabaseFiles(): Promise<void>;
  withExclusiveMaintenance<T>(
    operation: (maintenance: { removeDatabaseFiles(): Promise<void> }) => Promise<T>
  ): Promise<T>;
}

export type DatabaseTransactionConnection = Pick<
DatabaseConnection,
"runAsync" | "getAllAsync" | "getFirstAsync"
>;

export interface TransactionalEncryptedDatabaseManager extends EncryptedDatabaseManager {
  withTransaction<T>(
    operation: (connection: DatabaseTransactionConnection) => Promise<T>
  ): Promise<T>;
}

type Dependencies = {
  native: NativeDatabaseAdapter;
  files: DatabaseFileAdapter;
  secrets: DatabaseSecretRepository;
  databaseName?: string;
};

type UserVersionRow = { user_version: number };

function assertMigrationRegistry(): void {
  if (DATABASE_MIGRATIONS.length !== CURRENT_SCHEMA_VERSION) {
    throw new Error("Database migration registry does not match CURRENT_SCHEMA_VERSION");
  }
  for (const [index, migration] of DATABASE_MIGRATIONS.entries()) {
    if (migration.version !== index + 1) {
      throw new Error("Database migration versions must be contiguous and start at 1");
    }
  }
}

assertMigrationRegistry();

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

export type DatabaseRecoveryReason =
  | "missing-database"
  | "missing-key"
  | "invalid-key"
  | "key-mismatch";

export class DatabaseRecoveryRequiredError extends Error {
  readonly code = "DATABASE_RECOVERY_REQUIRED";
  override readonly cause?: unknown;

  constructor(readonly reason: DatabaseRecoveryReason, cause?: unknown) {
    super(`Database recovery required: ${reason}`);
    this.name = "DatabaseRecoveryRequiredError";
    if (cause !== undefined) this.cause = cause;
  }
}

export class LocalDataDeletionInProgressError extends Error {
  readonly code = "LOCAL_DATA_DELETION_IN_PROGRESS";

  constructor() {
    super("Local data deletion is in progress");
    this.name = "LocalDataDeletionInProgressError";
  }
}

export class DatabaseTransactionInProgressError extends Error {
  readonly code = "DATABASE_TRANSACTION_IN_PROGRESS";

  constructor() {
    super("Database transaction is in progress");
    this.name = "DatabaseTransactionInProgressError";
  }
}

type DatabaseCoordinator = {
  connection: ManagedDatabaseConnection | null;
  nativeConnection: DatabaseConnection | null;
  pendingClose: DatabaseConnection | null;
  initialization: Promise<ManagedDatabaseConnection> | null;
  lifecycle: Promise<void>;
  maintenanceRequests: number;
  transactionRequests: number;
  activeOperations: number;
  connectionGeneration: number;
  idleWaiters: Set<() => void>;
};

const stableCoordinators = new Map<string, DatabaseCoordinator>();
const adapterCoordinators = new WeakMap<
NativeDatabaseAdapter,
WeakMap<DatabaseFileAdapter, Map<string, DatabaseCoordinator>>
>();

function createCoordinator(): DatabaseCoordinator {
  return {
    connection: null,
    nativeConnection: null,
    pendingClose: null,
    initialization: null,
    lifecycle: Promise.resolve(),
    maintenanceRequests: 0,
    transactionRequests: 0,
    activeOperations: 0,
    connectionGeneration: 0,
    idleWaiters: new Set()
  };
}

function getCoordinator(
  native: NativeDatabaseAdapter,
  files: DatabaseFileAdapter,
  databaseName: string
): DatabaseCoordinator {
  const stableKey = files.coordinationKey?.trim();
  if (stableKey !== undefined && stableKey.length > 0) {
    const registryKey = JSON.stringify([stableKey, databaseName]);
    const existing = stableCoordinators.get(registryKey);
    if (existing !== undefined) return existing;
    const created = createCoordinator();
    stableCoordinators.set(registryKey, created);
    return created;
  }

  let byFiles = adapterCoordinators.get(native);
  if (byFiles === undefined) {
    byFiles = new WeakMap();
    adapterCoordinators.set(native, byFiles);
  }
  let byName = byFiles.get(files);
  if (byName === undefined) {
    byName = new Map();
    byFiles.set(files, byName);
  }
  const existing = byName.get(databaseName);
  if (existing !== undefined) return existing;
  const created = createCoordinator();
  byName.set(databaseName, created);
  return created;
}

function isSqlCipherKeyMismatch(error: unknown): boolean {
  if (error instanceof InvalidDatabaseKeyError) return true;
  if (!(error instanceof Error)) return false;
  return /(?:file is encrypted|file is not a database|^not a database$|wrong (?:database )?key|sqlcipher[^\n]*key)/iu
    .test(error.message);
}

function isTransactionControlSql(sql: string): boolean {
  const controlKeywords = new Set([
    "BEGIN",
    "COMMIT",
    "END",
    "ROLLBACK",
    "SAVEPOINT",
    "RELEASE"
  ]);
  let index = 0;
  let atStatementStart = true;

  function skipQuoted(closing: string): void {
    index += 1;
    while (index < sql.length) {
      if (sql[index] !== closing) {
        index += 1;
        continue;
      }
      if (sql[index + 1] === closing) {
        index += 2;
        continue;
      }
      index += 1;
      return;
    }
  }

  while (index < sql.length) {
    const current = sql[index]!;
    if (/\s/u.test(current)) {
      index += 1;
      continue;
    }
    if (current === "-" && sql[index + 1] === "-") {
      index += 2;
      while (index < sql.length && !/[\r\n]/u.test(sql[index]!)) index += 1;
      continue;
    }
    if (current === "/" && sql[index + 1] === "*") {
      index += 2;
      while (
        index < sql.length
        && !(sql[index] === "*" && sql[index + 1] === "/")
      ) index += 1;
      if (index < sql.length) index += 2;
      continue;
    }
    if (current === ";") {
      atStatementStart = true;
      index += 1;
      continue;
    }
    if (current === "'" || current === '"' || current === "`") {
      if (atStatementStart) atStatementStart = false;
      skipQuoted(current);
      continue;
    }
    if (current === "[") {
      if (atStatementStart) atStatementStart = false;
      skipQuoted("]");
      continue;
    }
    if (atStatementStart && /[A-Za-z]/u.test(current)) {
      const start = index;
      while (index < sql.length && /[A-Za-z]/u.test(sql[index]!)) index += 1;
      if (controlKeywords.has(sql.slice(start, index).toUpperCase())) return true;
      atStatementStart = false;
      continue;
    }
    atStatementStart = false;
    index += 1;
  }
  return false;
}

function assertDataSql(sql: string): void {
  if (isTransactionControlSql(sql)) {
    throw new Error("Transaction-control SQL is not allowed");
  }
}

function preserveCloseFailure(primaryError: unknown, closeError: unknown): void {
  if (!(primaryError instanceof Error)) return;
  const property = primaryError.cause === undefined ? "cause" : "closeError";
  Object.defineProperty(primaryError, property, {
    configurable: true,
    value: closeError
  });
}

export function createEncryptedDatabaseManager({
  native,
  files,
  secrets,
  databaseName = "cave.db"
}: Dependencies): TransactionalEncryptedDatabaseManager {
  const coordinator = getCoordinator(native, files, databaseName);

  function enqueueLifecycle<T>(operation: () => Promise<T>): Promise<T> {
    const scheduled = coordinator.lifecycle.then(operation, operation);
    coordinator.lifecycle = scheduled.then(() => undefined, () => undefined);
    return scheduled;
  }

  function enqueueMaintenance<T>(operation: () => Promise<T>): Promise<T> {
    coordinator.maintenanceRequests += 1;
    const scheduled = enqueueLifecycle(async () => {
      await waitForIdle();
      return await operation();
    });
    void scheduled.finally(() => {
      coordinator.maintenanceRequests -= 1;
    }).catch(() => undefined);
    return scheduled;
  }

  function waitForIdle(): Promise<void> {
    if (coordinator.activeOperations === 0) return Promise.resolve();
    return new Promise((resolve) => {
      coordinator.idleWaiters.add(resolve);
    });
  }

  async function acquireOperationLease(): Promise<void> {
    if (coordinator.transactionRequests > 0) {
      throw new DatabaseTransactionInProgressError();
    }
    if (
      coordinator.maintenanceRequests > 0
      || await secrets.hasPendingLocalDataDeletion()
      || coordinator.maintenanceRequests > 0
    ) {
      throw new LocalDataDeletionInProgressError();
    }
    if (coordinator.transactionRequests > 0) {
      throw new DatabaseTransactionInProgressError();
    }
    coordinator.activeOperations += 1;
  }

  function releaseOperationLease(): void {
    coordinator.activeOperations -= 1;
    if (coordinator.activeOperations === 0) {
      const waiters = [...coordinator.idleWaiters];
      coordinator.idleWaiters.clear();
      for (const resolve of waiters) resolve();
    }
  }

  async function trackOperation<T>(
    operation: () => Promise<T>,
    assertActive?: () => void
  ): Promise<T> {
    assertActive?.();
    await acquireOperationLease();
    try {
      assertActive?.();
      return await operation();
    } finally {
      releaseOperationLease();
    }
  }

  function createTrackedConnection(opened: DatabaseConnection): ManagedDatabaseConnection {
    const generation = ++coordinator.connectionGeneration;

    function assertActive(): void {
      if (
        coordinator.connectionGeneration !== generation
        || coordinator.nativeConnection !== opened
      ) {
        throw new Error("Database connection is no longer active");
      }
    }

    async function runManaged<T>(
      sql: string,
      operation: () => Promise<T>
    ): Promise<T> {
      assertDataSql(sql);
      return await trackOperation(operation, assertActive);
    }

    return {
      runAsync: (sql, ...params) => runManaged(sql,
        () => opened.runAsync(sql, ...params)
      ),
      getAllAsync: <T,>(sql: string, ...params: unknown[]) => runManaged(sql,
        () => opened.getAllAsync<T>(sql, ...params)
      ),
      getFirstAsync: <T,>(sql: string, ...params: unknown[]) => runManaged(sql,
        () => opened.getFirstAsync<T>(sql, ...params)
      )
    };
  }

  function createTransactionConnection(
    opened: DatabaseConnection,
    track: <T>(operation: () => Promise<T>) => Promise<T>
  ): DatabaseTransactionConnection {
    function runTransaction<T>(
      sql: string,
      operation: () => Promise<T>
    ): Promise<T> {
      return track(async () => {
        assertDataSql(sql);
        return await operation();
      });
    }

    return {
      runAsync: (sql, ...params) => runTransaction(sql,
        () => opened.runAsync(sql, ...params)
      ),
      getAllAsync: <T,>(sql: string, ...params: unknown[]) => runTransaction(sql,
        () => opened.getAllAsync<T>(sql, ...params)
      ),
      getFirstAsync: <T,>(sql: string, ...params: unknown[]) => runTransaction(sql,
        () => opened.getFirstAsync<T>(sql, ...params)
      )
    };
  }

  function createTransactionOperationTracker() {
    let tokenActive = true;
    let failed = false;
    let failure: unknown;
    const pending = new Set<Promise<void>>();

    function rejectedToken<T>(): Promise<T> {
      const rejection = Promise.reject<T>(
        new Error("Database transaction token is no longer active")
      );
      void rejection.catch(() => undefined);
      return rejection;
    }

    function track<T>(operation: () => Promise<T>): Promise<T> {
      if (!tokenActive) return rejectedToken<T>();

      const result = Promise.resolve().then(operation);
      const observed = result.catch((error: unknown) => {
        if (!failed) {
          failed = true;
          failure = error;
        }
        throw error;
      });
      void observed.catch(() => undefined);

      const settlement = observed.then(
        () => {
          pending.delete(settlement);
        },
        () => {
          pending.delete(settlement);
        }
      );
      pending.add(settlement);
      return observed;
    }

    return {
      track,
      closeToken() {
        tokenActive = false;
      },
      async waitForSettled() {
        await Promise.all([...pending]);
      },
      getFailure() {
        return { failed, failure };
      }
    };
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
      let currentVersion = await readCurrentVersion(opened);
      for (const migration of DATABASE_MIGRATIONS) {
        if (currentVersion < migration.version) {
          currentVersion = await applyMigration(
            opened,
            migration.schema,
            migration.version
          );
        }
      }
      return opened;
    } catch (error) {
      try {
        await opened.closeAsync();
      } catch (closeError) {
        coordinator.pendingClose = opened;
        preserveCloseFailure(error, closeError);
      }
      throw error;
    }
  }

  async function initializeOnce(): Promise<ManagedDatabaseConnection> {
    if (await secrets.hasPendingLocalDataDeletion()) {
      throw new LocalDataDeletionInProgressError();
    }
    if (coordinator.pendingClose !== null) await closeConnection();
    if (coordinator.connection !== null) return coordinator.connection;

    const databaseExists = await files.databaseExists(databaseName);
    const existingKey = await secrets.getDatabaseKey();
    if (databaseExists && existingKey === null) {
      throw new DatabaseRecoveryRequiredError("missing-key");
    }
    if (!databaseExists && existingKey !== null) {
      throw new DatabaseRecoveryRequiredError("missing-database");
    }

    const key = await secrets.getOrCreateDatabaseKey();
    try {
      const opened = await openAndMigrate(key);
      coordinator.nativeConnection = opened;
      coordinator.connection = createTrackedConnection(opened);
    } catch (error) {
      coordinator.connection = null;
      if (error instanceof InvalidDatabaseKeyError) {
        throw new DatabaseRecoveryRequiredError("invalid-key", error);
      }
      if (isSqlCipherKeyMismatch(error)) {
        throw new DatabaseRecoveryRequiredError("key-mismatch", error);
      }
      throw error;
    }
    return coordinator.connection;
  }

  function initialize(): Promise<ManagedDatabaseConnection> {
    if (coordinator.initialization !== null) return coordinator.initialization;

    const attempt = enqueueLifecycle(initializeOnce);
    coordinator.initialization = attempt;
    void attempt.finally(() => {
      if (coordinator.initialization === attempt) coordinator.initialization = null;
    }).catch(() => undefined);
    return attempt;
  }

  function poisonConnection(opened: DatabaseConnection): void {
    coordinator.connection = null;
    if (coordinator.nativeConnection === opened) coordinator.nativeConnection = null;
    coordinator.pendingClose = opened;
  }

  function withTransaction<T>(
    operation: (connection: DatabaseTransactionConnection) => Promise<T>
  ): Promise<T> {
    coordinator.transactionRequests += 1;
    const scheduled = enqueueLifecycle(async () => {
      await initializeOnce();
      await waitForIdle();
      const opened = coordinator.nativeConnection;
      if (opened === null) throw new Error("Database connection is unavailable");

      coordinator.activeOperations += 1;
      const tracker = createTransactionOperationTracker();
      const transaction = createTransactionConnection(opened, tracker.track);
      try {
        await opened.execAsync("BEGIN IMMEDIATE");
        let result: T;
        let failed = false;
        let failure: unknown;
        try {
          result = await operation(transaction);
        } catch (error) {
          failed = true;
          failure = error;
        }
        tracker.closeToken();
        await tracker.waitForSettled();
        const operationFailure = tracker.getFailure();
        if (!failed && operationFailure.failed) {
          failed = true;
          failure = operationFailure.failure;
        }
        if (!failed) {
          try {
            await opened.execAsync("COMMIT");
          } catch (error) {
            failed = true;
            failure = error;
          }
        }
        if (failed) {
          try {
            await opened.execAsync("ROLLBACK");
          } catch {
            poisonConnection(opened);
          }
          throw failure;
        }
        return result!;
      } finally {
        tracker.closeToken();
        releaseOperationLease();
      }
    });
    void scheduled.finally(() => {
      coordinator.transactionRequests -= 1;
    }).catch(() => undefined);
    return scheduled;
  }

  async function closeConnection(): Promise<void> {
    const opened = coordinator.nativeConnection ?? coordinator.pendingClose;
    if (opened === null) return;
    coordinator.connection = null;
    coordinator.nativeConnection = null;
    coordinator.pendingClose = opened;
    await opened.closeAsync();
    if (coordinator.pendingClose === opened) coordinator.pendingClose = null;
  }

  return {
    initialize,
    withTransaction,
    close() {
      coordinator.initialization = null;
      return enqueueMaintenance(closeConnection);
    },
    removeDatabaseFiles() {
      coordinator.initialization = null;
      return enqueueMaintenance(async () => {
        await closeConnection();
        await files.removeDatabaseFiles(databaseName);
      });
    },
    withExclusiveMaintenance<T>(
      operation: (maintenance: { removeDatabaseFiles(): Promise<void> }) => Promise<T>
    ) {
      coordinator.initialization = null;
      return enqueueMaintenance(async () => {
        await closeConnection();
        return await operation({
          removeDatabaseFiles: () => files.removeDatabaseFiles(databaseName)
        });
      });
    }
  };
}

async function readCurrentVersion(connection: DatabaseConnection): Promise<number> {
  await connection.execAsync("BEGIN IMMEDIATE");
  try {
    const row = await connection.getFirstAsync<UserVersionRow>("PRAGMA user_version");
    const version = row?.user_version ?? 0;
    if (version > CURRENT_SCHEMA_VERSION) {
      throw new UnsupportedDatabaseVersionError(version);
    }
    await connection.execAsync("COMMIT");
    return version;
  } catch (error) {
    await connection.execAsync("ROLLBACK");
    throw error;
  }
}

async function applyMigration(
  connection: DatabaseConnection,
  schema: string,
  version: number
): Promise<number> {
  await connection.execAsync("BEGIN IMMEDIATE");
  try {
    const row = await connection.getFirstAsync<UserVersionRow>("PRAGMA user_version");
    const lockedVersion = row?.user_version ?? 0;
    if (lockedVersion > CURRENT_SCHEMA_VERSION) {
      throw new UnsupportedDatabaseVersionError(lockedVersion);
    }
    if (lockedVersion >= version) {
      await connection.execAsync("COMMIT");
      return lockedVersion;
    }
    await connection.execAsync(schema);
    await connection.execAsync(`PRAGMA user_version = ${version}`);
    await connection.execAsync("COMMIT");
    return version;
  } catch (error) {
    await connection.execAsync("ROLLBACK");
    throw error;
  }
}

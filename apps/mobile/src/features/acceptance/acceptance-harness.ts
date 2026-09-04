import { createEncryptedDatabaseManager, type DatabaseConnection, type DatabaseFileAdapter, type NativeDatabaseAdapter } from '../../core/storage/database';
import { createSecretRepository, SECRET_NAMES, type SecureStoreAdapter } from '../../core/storage/key-store';
import { deleteAllData, DeleteAllDataIncompleteError, type DeleteAllDataStage } from '../../core/privacy/delete-all-data';
import { HISTORICAL_DATABASE_FIXTURES } from '../../test/storage/historical-fixtures';

export const ACCEPTANCE_DATABASE = 'cave-acceptance.db';
export const ACCEPTANCE_PREFIX = 'cave.acceptance.';
export const ACCEPTANCE_FIXTURES = ['v6-legacy-collision', 'v11'] as const;
export const DELETION_STAGES: readonly DeleteAllDataStage[] = ['record-intent', 'clear-gate', 'quiesce', 'delete-key', 'remove-files', 'delete-account-profiles', 'delete-token', 'delete-auth-session', 'clear-intent'];
export type AcceptanceExtra = { acceptanceTools?: unknown; environment?: unknown };
export function isAcceptanceToolsEnabled(dev: boolean, extra?: AcceptanceExtra | null): boolean {
  return dev === true && extra?.acceptanceTools === true && extra.environment === 'acceptance';
}
export type AcceptanceMetadata = {
  databasePresent: boolean; walPresent: boolean; shmPresent: boolean; profilePresent: boolean;
  keyPresent: boolean; deletionPending: boolean; tokenPresent: boolean; sessionPresent: boolean; adultPresent: boolean;
  version?: number; counts?: Record<string, number>;
};
export type AcceptanceState = {
  status: 'idle' | 'running' | 'paused' | 'success' | 'error' | 'disabled'; busy: boolean;
  operation?: string; stage?: DeleteAllDataStage | 'migration-v12-before-commit'; error?: string;
  metadata?: AcceptanceMetadata; checks?: Record<string, boolean>;
};
export type AcceptanceDependencies = {
  enabled(): boolean;
  native: NativeDatabaseAdapter; files: DatabaseFileAdapter; secureStore: SecureStoreAdapter;
  randomBytes(length: number): Uint8Array | Promise<Uint8Array>;
  profiles: { exists(): Promise<boolean>; seed(): Promise<void>; clearAll(): Promise<void> };
};
class AcceptanceError extends Error { constructor(readonly code: string) { super(code); } }
const TABLES = ['course_progress', 'saved_records', 'journey_drafts', 'journey_drafts_v2', 'journey_drafts_v3', 'journey_drafts_v4', 'journey_review_versions', 'journal_records', 'journal_entries', 'journal_period_reviews'] as const;
const OPTIONS = { keychainAccessible: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY' } as const;

export function createAcceptanceHarness(deps: AcceptanceDependencies) {
  let state: AcceptanceState = { status: deps.enabled() ? 'idle' : 'disabled', busy: false };
  const listeners = new Set<() => void>();
  let releasePause: (() => void) | undefined;
  let migrationMode: 'none' | 'pause' | 'fault' = 'none';
  let failNextKeyRead = false;
  const pendingCloses = new Set<() => Promise<void>>();
  function update(next: AcceptanceState) { state = next; for (const listener of listeners) listener(); }
  function assertEnabled() { if (!deps.enabled()) throw new AcceptanceError('DISABLED'); }
  function target(name: string) {
    assertEnabled();
    if (name !== ACCEPTANCE_DATABASE) throw new AcceptanceError('INVALID_TARGET');
  }
  const scopedStore: SecureStoreAdapter = {
    getItemAsync(key) {
      assertEnabled();
      if (!Object.values(SECRET_NAMES).includes(key as never)) throw new AcceptanceError('INVALID_TARGET');
      if (failNextKeyRead && key === SECRET_NAMES.databaseKey) {
        failNextKeyRead = false; throw new AcceptanceError('KEYCHAIN_TRANSIENT');
      }
      return deps.secureStore.getItemAsync(ACCEPTANCE_PREFIX + key);
    },
    setItemAsync(key, value, options) {
      assertEnabled();
      if (!Object.values(SECRET_NAMES).includes(key as never)) throw new AcceptanceError('INVALID_TARGET');
      return deps.secureStore.setItemAsync(ACCEPTANCE_PREFIX + key, value, options);
    },
    deleteItemAsync(key) {
      assertEnabled();
      if (!Object.values(SECRET_NAMES).includes(key as never)) throw new AcceptanceError('INVALID_TARGET');
      return deps.secureStore.deleteItemAsync(ACCEPTANCE_PREFIX + key);
    },
  };
  const secrets = createSecretRepository({ secureStore: scopedStore, randomBytes: deps.randomBytes });
  async function pause(stage: NonNullable<AcceptanceState['stage']>) {
    await new Promise<void>((resolve) => {
      releasePause = resolve;
      update({ ...state, status: 'paused', stage, busy: true });
    });
    releasePause = undefined;
    update({ ...state, status: 'running', busy: true });
  }
  const native: NativeDatabaseAdapter = {
    async openDatabaseAsync(name) {
      target(name);
      const connection = await deps.native.openDatabaseAsync(name);
      let closed = false;
      const close = async () => {
        if (closed) return;
        pendingCloses.add(close);
        await connection.closeAsync();
        closed = true;
        pendingCloses.delete(close);
      };
      return {
        ...connection,
        runAsync: (sql, ...params) => connection.runAsync(sql, ...params),
        getFirstAsync: <T,>(sql: string, ...params: unknown[]) => connection.getFirstAsync<T>(sql, ...params),
        getAllAsync: <T,>(sql: string, ...params: unknown[]) => connection.getAllAsync<T>(sql, ...params),
        closeAsync: close,
        async execAsync(sql) {
          await connection.execAsync(sql);
          if (sql === 'PRAGMA user_version = 12' && migrationMode !== 'none') {
            const selected = migrationMode; migrationMode = 'none';
            if (selected === 'pause') await pause('migration-v12-before-commit');
            else throw new AcceptanceError('MIGRATION_FAULT_INJECTED');
          }
        },
      };
    },
  };
  const files: DatabaseFileAdapter = {
    get coordinationKey() { return deps.files.coordinationKey ?? ''; },
    databaseExists(name) { target(name); return deps.files.databaseExists(name); },
    removeDatabaseFiles(name) { target(name); return deps.files.removeDatabaseFiles(name); },
  };
  // Construct lazily: disabled builds do not even access a native path getter.
  let manager: ReturnType<typeof createEncryptedDatabaseManager> | undefined;
  function database() {
    assertEnabled();
    return manager ??= createEncryptedDatabaseManager({ native, files, secrets, databaseName: ACCEPTANCE_DATABASE });
  }
  async function execute(operation: string, task: () => Promise<Partial<AcceptanceState> | void>) {
    if (!deps.enabled()) { if (!state.busy) update({ status: 'disabled', busy: false }); return; }
    if (state.busy) return;
    update({ status: 'running', busy: true, operation });
    try {
      // A native close failure retains the handle; no new operation can bypass its retry.
      for (const close of pendingCloses) await close();
      const result = await task();
      update({ status: 'success', busy: false, operation, ...result });
    } catch (error) {
      // Native exception messages can contain SQL, file paths and parameters. Never surface them.
      update({ status: 'error', busy: false, operation,
        error: error instanceof AcceptanceError ? error.code : 'OPERATION_FAILED',
        ...(error instanceof DeleteAllDataIncompleteError ? { stage: error.stage } : {}),
      });
    } finally { migrationMode = 'none'; }
  }
  async function presence(): Promise<AcceptanceMetadata> {
    assertEnabled();
    return {
      databasePresent: await files.databaseExists(ACCEPTANCE_DATABASE),
      walPresent: await deps.files.databaseExists(`${ACCEPTANCE_DATABASE}-wal`),
      shmPresent: await deps.files.databaseExists(`${ACCEPTANCE_DATABASE}-shm`),
      profilePresent: await deps.profiles.exists(),
      keyPresent: await secrets.getDatabaseKey() !== null,
      deletionPending: await secrets.hasPendingLocalDataDeletion(),
      tokenPresent: await scopedStore.getItemAsync(SECRET_NAMES.installationToken) !== null,
      sessionPresent: await scopedStore.getItemAsync(SECRET_NAMES.authSession) !== null,
      adultPresent: await scopedStore.getItemAsync(SECRET_NAMES.adultDeclaration) !== null,
    };
  }
  function keySql(key: string) {
    if (!/^[A-Za-z0-9+/]{43}=$/u.test(key)) throw new AcceptanceError('INVALID_SYNTHETIC_KEY');
    return `PRAGMA key = '${key}'`;
  }
  async function capability(connection: DatabaseConnection): Promise<void> {
    const row = await connection.getFirstAsync<{ cipher_version?: unknown }>('PRAGMA cipher_version');
    if (typeof row?.cipher_version !== 'string' || row.cipher_version.trim() === '') throw new AcceptanceError('SQLCIPHER_UNAVAILABLE');
  }
  async function readMetadata(): Promise<AcceptanceMetadata> {
    await database().close();
    const metadata = await presence();
    if (!metadata.databasePresent || !metadata.keyPresent || metadata.deletionPending) return metadata;
    const key = await secrets.getDatabaseKey();
    const connection = await native.openDatabaseAsync(ACCEPTANCE_DATABASE);
    try {
      await capability(connection); await connection.execAsync(keySql(key!));
      const row = await connection.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      if (row) metadata.version = row.user_version;
      metadata.counts = {};
      for (const table of TABLES) {
        const found = await connection.getFirstAsync<{ count: number }>("SELECT count(*) AS count FROM sqlite_master WHERE type='table' AND name=?", table);
        if (found?.count === 1) {
          const count = await connection.getFirstAsync<{ count: number }>(`SELECT count(*) AS count FROM ${table}`);
          metadata.counts[table] = count?.count ?? 0;
        }
      }
      return metadata;
    } finally { await connection.closeAsync(); }
  }
  async function performDeletion(pauseAfter?: DeleteAllDataStage) {
    const after = async (stage: DeleteAllDataStage, action: () => Promise<void>) => {
      await action();
      update({ ...state, stage });
      if (stage === pauseAfter) await pause(stage);
    };
    const db = database();
    await deleteAllData({
      database: {
        ...db,
        withExclusiveMaintenance: (operation) => db.withExclusiveMaintenance(async (maintenance) => {
          await after('quiesce', async () => {});
          return operation({ removeDatabaseFiles: () => after('remove-files', maintenance.removeDatabaseFiles) });
        }),
      },
      accountProfiles: { clearAll: () => after('delete-account-profiles', deps.profiles.clearAll) },
      secrets: {
        recordPendingLocalDataDeletion: () => after('record-intent', secrets.recordPendingLocalDataDeletion),
        deleteAdultDeclaration: () => after('clear-gate', secrets.deleteAdultDeclaration),
        deleteDatabaseKey: () => after('delete-key', secrets.deleteDatabaseKey),
        deleteInstallationToken: () => after('delete-token', secrets.deleteInstallationToken),
        deleteAuthSession: () => after('delete-auth-session', secrets.deleteAuthSession),
        clearPendingLocalDataDeletion: () => after('clear-intent', secrets.clearPendingLocalDataDeletion),
      },
    });
  }
  async function requireFixture() {
    if (await secrets.hasPendingLocalDataDeletion()) throw new AcceptanceError('DELETION_PENDING');
    if (!await files.databaseExists(ACCEPTANCE_DATABASE) || await secrets.getDatabaseKey() === null) throw new AcceptanceError('FIXTURE_REQUIRED');
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    resumePaused() { if (deps.enabled()) releasePause?.(); },
    startup: () => execute('startup', async () => {
      if (await secrets.hasPendingLocalDataDeletion()) await performDeletion();
      return { metadata: await readMetadata() };
    }),
    inspect: () => execute('inspect', async () => ({ metadata: await readMetadata() })),
    createFixture: (id: string) => execute('create-fixture', async () => {
      if (!ACCEPTANCE_FIXTURES.includes(id as never)) throw new AcceptanceError('INVALID_FIXTURE');
      await database().close();
      const before = await presence();
      if (Object.values(before).some(Boolean)
        || await scopedStore.getItemAsync(SECRET_NAMES.deletionPending) !== null) {
        throw new AcceptanceError('STORE_NOT_EMPTY');
      }
      const fixture = HISTORICAL_DATABASE_FIXTURES.find((item) => item.id === id)!;
      const key = await secrets.getOrCreateDatabaseKey();
      const connection = await native.openDatabaseAsync(ACCEPTANCE_DATABASE);
      try {
        await capability(connection); await connection.execAsync(keySql(key));
        await connection.execAsync('PRAGMA foreign_keys = ON');
        await connection.execAsync('BEGIN IMMEDIATE');
        try {
          await connection.execAsync(fixture.schemaSql); await connection.execAsync(fixture.seedSql);
          await connection.execAsync(`PRAGMA user_version = ${fixture.version}`);
          await connection.execAsync('COMMIT');
        } catch (error) { await connection.execAsync('ROLLBACK'); throw error; }
      } finally { await connection.closeAsync(); }
      await deps.profiles.seed();
      await secrets.recordAdultDeclaration(); await secrets.getOrCreateInstallationToken();
      await scopedStore.setItemAsync(SECRET_NAMES.authSession, '{"synthetic":true}', OPTIONS);
      return { metadata: { ...await presence(), version: fixture.version } };
    }),
    upgrade: (mode: 'none' | 'pause' | 'fault' = 'none') => execute('upgrade', async () => {
      await requireFixture(); await database().close(); migrationMode = mode;
      try {
        await database().initialize();
        if (mode !== 'none' && migrationMode !== 'none') throw new AcceptanceError('MIGRATION_STAGE_NOT_REACHED');
      } finally { await database().close(); }
      return { metadata: await readMetadata() };
    }),
    deleteSyntheticData: (pauseAfter?: DeleteAllDataStage) => execute('delete-synthetic-data', async () => {
      if (pauseAfter !== undefined && !DELETION_STAGES.includes(pauseAfter)) throw new AcceptanceError('INVALID_STAGE');
      await performDeletion(pauseAfter); return { metadata: await presence() };
    }),
    probeCipher: () => execute('cipher-probe', async () => {
      await requireFixture(); await database().close();
      const key = (await secrets.getDatabaseKey())!;
      // Random bytes are converted to a safe literal without logging them or persisting another key.
      const bytes = await deps.randomBytes(32);
      if (bytes.length !== 32) throw new AcceptanceError('ENTROPY_UNAVAILABLE');
      const wrongKey = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      const checks: Record<string, boolean> = { cipherAvailable: true };
      for (const kind of ['noKey', 'wrongKey', 'correctKey'] as const) {
        const connection = await native.openDatabaseAsync(ACCEPTANCE_DATABASE);
        try {
          await capability(connection);
          if (kind === 'correctKey') await connection.execAsync(keySql(key));
          if (kind === 'wrongKey') await connection.execAsync(`PRAGMA key = '${wrongKey}'`);
          let read = false;
          try {
            const row = await connection.getFirstAsync<{ count: number }>("SELECT count(*) AS count FROM saved_records WHERE id='saved-fixture'");
            read = row?.count === 1;
            if (kind !== 'correctKey') throw new AcceptanceError('UNKEYED_READ_SUCCEEDED');
          } catch (error) {
            if (error instanceof AcceptanceError || kind === 'correctKey') throw error;
            checks[kind] = true;
          }
          if (kind === 'correctKey') { if (!read) throw new AcceptanceError('SYNTHETIC_ROW_MISSING'); checks[kind] = true; }
        } finally { await connection.closeAsync(); }
      }
      return { checks };
    }),
    keychainDiagnostic: () => execute('keychain-retry', async () => {
      await requireFixture(); await database().close();
      const before = await secrets.getDatabaseKey();
      let rejected = false; failNextKeyRead = true;
      try { await database().initialize(); }
      catch (error) { if (!(error instanceof AcceptanceError) || error.code !== 'KEYCHAIN_TRANSIENT') throw error; rejected = true; }
      finally { failNextKeyRead = false; await database().close(); }
      const preserved = before === await secrets.getDatabaseKey() && await files.databaseExists(ACCEPTANCE_DATABASE);
      if (!rejected || !preserved) throw new AcceptanceError('KEYCHAIN_PRESERVATION_FAILED');
      try { await database().initialize(); } finally { await database().close(); }
      return { checks: { transientReadRejected: rejected, keyAndFilePreserved: preserved, retrySucceeded: true } };
    }),
  };
}
export type AcceptanceHarness = ReturnType<typeof createAcceptanceHarness>;

/** @jest-environment node */
// Exercises production migration/deletion behavior with real SQLite, NOT SQLCipher.
import { createSqliteFileHarness } from '../../test/storage/sqlite-file-harness';
import { HISTORICAL_DATABASE_FIXTURES } from '../../test/storage/historical-fixtures';
import { SECRET_NAMES } from '../../core/storage/key-store';
import { ACCEPTANCE_PREFIX, createAcceptanceHarness } from './acceptance-harness';

const active: ReturnType<typeof createSqliteFileHarness>[] = [];
afterEach(() => { active.splice(0).forEach((h) => h.cleanup()); });
function setup() {
  const h = createSqliteFileHarness(HISTORICAL_DATABASE_FIXTURES.find((f) => f.id === 'v11'));
  active.push(h);
  const key = h.values.get(SECRET_NAMES.databaseKey)!;
  h.values.clear(); h.values.set(ACCEPTANCE_PREFIX + SECRET_NAMES.databaseKey, key);
  const deps = {
    enabled: () => true, native: h.native, files: h.files, randomBytes: () => new Uint8Array(32).fill(8),
    secureStore: {
      async getItemAsync(name: string) { return h.values.get(name) ?? null; },
      async setItemAsync(name: string, value: string) { h.values.set(name, value); },
      async deleteItemAsync(name: string) { h.values.delete(name); },
    },
    profiles: { exists: async () => false, seed: async () => {}, clearAll: async () => {} },
  };
  return { h, harness: createAcceptanceHarness(deps) };
}
test('v12 injected fault rolls back version and ownership schema, then retries real migration', async () => {
  const { h, harness } = setup();
  await harness.upgrade('fault');
  expect(harness.getSnapshot()).toMatchObject({ status: 'error', error: 'MIGRATION_FAULT_INJECTED' });
  const db = h.openRaw();
  expect(db.prepare('PRAGMA user_version').get()).toEqual({ user_version: 11 });
  expect(db.prepare('PRAGMA table_info(journal_records)').all().some((column) => column.name === 'owner_account_id')).toBe(false);
  expect(db.prepare('SELECT count(*) AS count FROM journal_records').get()).toEqual({ count: 1 });
  h.closeRaw(db);
  await harness.upgrade();
  expect(harness.getSnapshot()).toMatchObject({ status: 'success', metadata: { version: 12, counts: { journal_records: 1, journal_entries: 1 } } });
});
test('pause occurs before migration commit: another connection still observes version 11', async () => {
  const { h, harness } = setup();
  const reached = new Promise<void>((resolve) => {
    const unsubscribe = harness.subscribe(() => { if (harness.getSnapshot().status === 'paused') { unsubscribe(); resolve(); } });
  });
  const upgrading = harness.upgrade('pause');
  await reached;
  expect(harness.getSnapshot()).toMatchObject({ status: 'paused', busy: true, stage: 'migration-v12-before-commit' });
  const db = h.openRaw();
  expect(db.prepare('PRAGMA user_version').get()).toEqual({ user_version: 11 });
  h.closeRaw(db);
  harness.resumePaused(); await upgrading;
  expect(harness.getSnapshot()).toMatchObject({ status: 'success', metadata: { version: 12 } });
});
test('transient keychain read failure preserves the original file/key and retries without removing files', async () => {
  const { h, harness } = setup();
  await harness.keychainDiagnostic();
  expect(harness.getSnapshot()).toMatchObject({ status: 'success', checks: { transientReadRejected: true, keyAndFilePreserved: true, retrySucceeded: true } });
  expect(h.events).not.toContain('removed-files');
  expect(h.values.has(ACCEPTANCE_PREFIX + SECRET_NAMES.databaseKey)).toBe(true);
});

import { createAcceptanceHarness, isAcceptanceToolsEnabled, ACCEPTANCE_DATABASE, ACCEPTANCE_PREFIX, DELETION_STAGES } from './acceptance-harness';
import { SECRET_NAMES } from '../../core/storage/key-store';
import type { DatabaseConnection } from '../../core/storage/database';

function setup(enabled = true) {
  const values = new Map<string, string>();
  let exists = false;
  let profile = false;
  const events: string[] = [];
  const connection: DatabaseConnection = {
    execAsync: jest.fn(async () => {}), runAsync: jest.fn(async () => ({ changes: 1 })),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async (sql: string) => (sql === 'PRAGMA cipher_version'
      ? { cipher_version: 'TEST-ONLY' } : sql === 'PRAGMA user_version' ? { user_version: 12 } : { count: 1 }) as never),
    closeAsync: jest.fn(async () => { events.push('close'); }),
  };
  const deps = {
    enabled: () => enabled,
    native: { openDatabaseAsync: jest.fn(async (name: string) => { events.push(`open:${name}`); exists = true; return connection; }) },
    files: {
      databaseExists: jest.fn(async (name: string) => { events.push(`exists:${name}`); return name === ACCEPTANCE_DATABASE && exists; }),
      removeDatabaseFiles: jest.fn(async (name: string) => { events.push(`remove:${name}`); exists = false; }),
    },
    secureStore: {
      getItemAsync: jest.fn(async (key: string) => { events.push(`get:${key}`); return values.get(key) ?? null; }),
      setItemAsync: jest.fn(async (key: string, value: string) => { events.push(`set:${key}`); values.set(key, value); }),
      deleteItemAsync: jest.fn(async (key: string) => { events.push(`delete:${key}`); values.delete(key); }),
    },
    randomBytes: () => new Uint8Array(32).fill(7),
    profiles: {
      exists: async () => profile, seed: async () => { profile = true; }, clearAll: async () => { profile = false; events.push('profiles'); },
    },
  };
  return { harness: createAcceptanceHarness(deps), deps, values, events, connection, setExists: () => { exists = true; } };
}

test.each([[false, true, 'acceptance'], [true, false, 'acceptance'], [true, true, 'production'], [true, 'true', 'acceptance']])(
  'fails closed for gate %p %p %p', (dev, acceptanceTools, environment) => {
    expect(isAcceptanceToolsEnabled(dev as boolean, { acceptanceTools, environment })).toBe(false);
  });
test('requires all three gate conditions', () => {
  expect(isAcceptanceToolsEnabled(true, { acceptanceTools: true, environment: 'acceptance' })).toBe(true);
});
test('disabled harness performs zero I/O for every operation', async () => {
  const h = setup(false);
  await h.harness.startup(); await h.harness.createFixture('v11'); await h.harness.upgrade();
  await h.harness.inspect(); await h.harness.probeCipher(); await h.harness.deleteSyntheticData();
  await h.harness.keychainDiagnostic(); h.harness.resumePaused();
  expect(h.events).toEqual([]);
  expect(h.harness.getSnapshot().status).toBe('disabled');
});
test('fixture creation refuses an existing synthetic file without overwriting any secret or opening a handle', async () => {
  const h = setup(); h.setExists();
  await h.harness.createFixture('v11');
  expect(h.harness.getSnapshot().error).toBe('STORE_NOT_EMPTY');
  expect(h.deps.native.openDatabaseAsync).not.toHaveBeenCalled();
  expect(h.deps.secureStore.setItemAsync).not.toHaveBeenCalled();
});
test.each(Object.values(SECRET_NAMES))('fixture creation refuses any existing synthetic secret, including malformed %s', async (name) => {
  const h = setup(); h.values.set(ACCEPTANCE_PREFIX + name, 'malformed-synthetic-value');
  await h.harness.createFixture('v11');
  expect(h.harness.getSnapshot().error).toBe('STORE_NOT_EMPTY');
  expect(h.deps.native.openDatabaseAsync).not.toHaveBeenCalled();
  expect(h.values.get(ACCEPTANCE_PREFIX + name)).toBe('malformed-synthetic-value');
});
test('all fixture writes target only synthetic database and namespaced secrets', async () => {
  const h = setup(); await h.harness.createFixture('v6-legacy-collision');
  expect(h.deps.native.openDatabaseAsync).toHaveBeenCalledWith(ACCEPTANCE_DATABASE);
  expect([...h.values.keys()].every((key) => key.startsWith(ACCEPTANCE_PREFIX))).toBe(true);
  expect(h.values.has(SECRET_NAMES.databaseKey)).toBe(false);
  expect(h.connection.closeAsync).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(h.harness.getSnapshot())).not.toMatch(/synthetic body|BwcHBwc|PRAGMA key/);
});
test('durable deletion pause blocks concurrent operations, and a new harness resumes only cleanup', async () => {
  const h = setup(); await h.harness.createFixture('v11');
  const deleting = h.harness.deleteSyntheticData('delete-key');
  for (let i = 0; i < 30 && h.harness.getSnapshot().status !== 'paused'; i++) await Promise.resolve();
  expect(h.harness.getSnapshot()).toMatchObject({ status: 'paused', stage: 'delete-key', busy: true });
  expect(h.values.has(ACCEPTANCE_PREFIX + SECRET_NAMES.databaseKey)).toBe(false);
  const opens = h.deps.native.openDatabaseAsync.mock.calls.length;
  await h.harness.createFixture('v11');
  expect(h.deps.native.openDatabaseAsync).toHaveBeenCalledTimes(opens);
  // Releasing simulates continuing the same run; restart is separately exercised below.
  h.harness.resumePaused(); await deleting;
  expect(h.values.size).toBe(0);
  h.setExists(); h.values.set(ACCEPTANCE_PREFIX + SECRET_NAMES.deletionPending, 'pending');
  const restarted = createAcceptanceHarness(h.deps); await restarted.startup();
  expect(h.deps.native.openDatabaseAsync).toHaveBeenCalledTimes(opens);
  expect(h.deps.files.removeDatabaseFiles).toHaveBeenLastCalledWith(ACCEPTANCE_DATABASE);
  expect(h.values.size).toBe(0);
});
test('errors are reduced to safe codes without exposing native messages or secret values', async () => {
  const h = setup();
  h.deps.secureStore.getItemAsync.mockRejectedValueOnce(new Error('secret=private-key body=private-body'));
  await h.harness.startup();
  expect(h.harness.getSnapshot()).toMatchObject({ status: 'error', error: 'OPERATION_FAILED' });
  expect(JSON.stringify(h.harness.getSnapshot())).not.toMatch(/private|secret=/);
  expect(h.deps.native.openDatabaseAsync).not.toHaveBeenCalled();
});

test.each(DELETION_STAGES)('restart at durable %s resumes deletion without opening or rekeying', async (stage) => {
  const h = setup(); await h.harness.createFixture('v11');
  const operation = h.harness.deleteSyntheticData(stage);
  for (let i = 0; i < 100 && h.harness.getSnapshot().status !== 'paused'; i++) await Promise.resolve();
  expect(h.harness.getSnapshot()).toMatchObject({ status: 'paused', stage });
  expect(h.values.has(ACCEPTANCE_PREFIX + SECRET_NAMES.deletionPending)).toBe(stage !== 'clear-intent');
  const opens = h.deps.native.openDatabaseAsync.mock.calls.length;
  const writes = h.deps.secureStore.setItemAsync.mock.calls.filter(([key]) => key.endsWith(SECRET_NAMES.databaseKey)).length;
  const restarted = createAcceptanceHarness(h.deps);
  await restarted.startup();
  expect(restarted.getSnapshot()).toMatchObject({ status: 'success', metadata: { databasePresent: false, keyPresent: false, deletionPending: false, profilePresent: false } });
  expect(h.deps.native.openDatabaseAsync).toHaveBeenCalledTimes(opens);
  expect(h.deps.secureStore.setItemAsync.mock.calls.filter(([key]) => key.endsWith(SECRET_NAMES.databaseKey))).toHaveLength(writes);
  h.harness.resumePaused(); await operation;
});

test('cipher probe uses three separate connections, rejects keyless reads and closes every connection', async () => {
  const h = setup(); await h.harness.createFixture('v11');
  const connections: DatabaseConnection[] = [];
  const expectedKey = h.values.get(ACCEPTANCE_PREFIX + SECRET_NAMES.databaseKey)!;
  h.deps.native.openDatabaseAsync.mockImplementation(async () => {
    let keyed = false;
    const c: DatabaseConnection = { ...h.connection,
      execAsync: jest.fn(async (sql) => { keyed = sql === `PRAGMA key = '${expectedKey}'`; }),
      getFirstAsync: jest.fn(async (sql) => {
        if (sql === 'PRAGMA cipher_version') return { cipher_version: 'SIMULATED' } as never;
        if (!keyed) throw new Error('synthetic encrypted read failure');
        return { count: 1 } as never;
      }), closeAsync: jest.fn(async () => {}),
    }; connections.push(c); return c;
  });
  await h.harness.probeCipher();
  expect(h.harness.getSnapshot()).toMatchObject({ status: 'success', checks: { noKey: true, wrongKey: true, correctKey: true, cipherAvailable: true } });
  expect(connections).toHaveLength(3);
  connections.forEach((connection) => expect(connection.closeAsync).toHaveBeenCalledTimes(1));
  expect(JSON.stringify(h.harness.getSnapshot())).not.toContain(expectedKey);
});

test('cipher probe fails on plaintext-capable read and still closes its handle', async () => {
  const h = setup(); await h.harness.createFixture('v11');
  h.connection.closeAsync = jest.fn(async () => {});
  await h.harness.probeCipher();
  expect(h.harness.getSnapshot()).toMatchObject({ status: 'error', error: 'UNKEYED_READ_SUCCEEDED' });
  expect(h.connection.closeAsync).toHaveBeenCalledTimes(1);
});

test('retains a failed raw close and retries it before opening another native connection', async () => {
  const h = setup();
  const order: string[] = [];
  h.connection.closeAsync = jest.fn(async () => { order.push('close-ok'); })
    .mockImplementationOnce(async () => { order.push('close-failed'); throw new Error('close unavailable'); });
  h.deps.native.openDatabaseAsync.mockImplementation(async () => { order.push('open'); return h.connection; });
  await h.harness.createFixture('v11');
  expect(h.harness.getSnapshot().status).toBe('error');
  h.setExists();
  await h.harness.inspect();
  expect(order).toEqual(['open', 'close-failed', 'close-ok', 'open', 'close-ok']);
});

test('does not report success for an armed migration fault when the database is already current', async () => {
  const h = setup(); await h.harness.createFixture('v11');
  // This native double reports v12, representing an already-upgraded fixture.
  await h.harness.upgrade('fault');
  expect(h.harness.getSnapshot()).toMatchObject({ status: 'error', error: 'MIGRATION_STAGE_NOT_REACHED' });
});

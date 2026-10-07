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

type CipherProbeKind = 'noKey' | 'wrongKey' | 'correctKey';
const SYNTHETIC_PROBE_READ = "SELECT count(*) AS count FROM saved_records WHERE id='saved-fixture'";

// These handles model native read outcomes, not encryption. Real SQLCipher still requires a device.
async function setupCipherProbe(options: {
  reads?: Partial<Record<CipherProbeKind, { count: number } | null>>;
  failures?: Partial<Record<CipherProbeKind, Error>>;
  missingCapability?: { connectionIndex: number; row: unknown };
} = {}) {
  const h = setup();
  await h.harness.createFixture('v11');
  const expectedKey = h.values.get(ACCEPTANCE_PREFIX + SECRET_NAMES.databaseKey)!;
  const connections: DatabaseConnection[] = [];
  const order: string[] = [];
  h.deps.native.openDatabaseAsync.mockClear();
  h.deps.native.openDatabaseAsync.mockImplementation(async () => {
    const index = connections.length;
    let appliedKey: string | null = null;
    order.push(`open:${index}`);
    const connection: DatabaseConnection = {
      ...h.connection,
      execAsync: jest.fn(async (sql: string) => {
        const key = /^PRAGMA key = '([^']+)'$/u.exec(sql)?.[1];
        if (key !== undefined) appliedKey = key;
      }),
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql === 'PRAGMA cipher_version') {
          return (options.missingCapability?.connectionIndex === index
            ? options.missingCapability.row : { cipher_version: 'TEST-ONLY' }) as never;
        }
        if (sql !== SYNTHETIC_PROBE_READ) throw new Error('unexpected synthetic query');
        const kind: CipherProbeKind = appliedKey === null ? 'noKey'
          : appliedKey === expectedKey ? 'correctKey' : 'wrongKey';
        if (options.failures?.[kind]) throw options.failures[kind];
        if (Object.hasOwn(options.reads ?? {}, kind)) return options.reads![kind] as never;
        if (kind === 'correctKey') return { count: 1 } as never;
        throw new Error('synthetic encrypted read denied');
      }),
      closeAsync: jest.fn(async () => { order.push(`close:${index}`); }),
    };
    connections.push(connection);
    return connection;
  });
  return { ...h, connections, expectedKey, order };
}

test.each([
  ['noKey', { count: 0 }, 1],
  ['noKey', null, 1],
  ['wrongKey', { count: 1 }, 2],
  ['wrongKey', { count: 0 }, 2],
  ['wrongKey', null, 2],
] as const)('cipher probe rejects a readable %s connection even with result %p', async (kind, row, opened) => {
  const h = await setupCipherProbe({ reads: { [kind]: row } });
  await h.harness.probeCipher();
  expect(h.harness.getSnapshot()).toMatchObject({ status: 'error', error: 'UNKEYED_READ_SUCCEEDED' });
  expect(h.harness.getSnapshot().checks).toBeUndefined();
  expect(h.connections).toHaveLength(opened);
  h.connections.forEach(connection => expect(connection.closeAsync).toHaveBeenCalledTimes(1));
  expect(h.values.get(ACCEPTANCE_PREFIX + SECRET_NAMES.databaseKey)).toBe(h.expectedKey);
  expect(h.deps.files.removeDatabaseFiles).not.toHaveBeenCalled();
});

test.each([{ count: 0 }, null, { count: 2 }])('cipher probe requires exactly the synthetic row with the correct key: %p', async row => {
  const h = await setupCipherProbe({ reads: { correctKey: row } });
  await h.harness.probeCipher();
  expect(h.harness.getSnapshot()).toMatchObject({ status: 'error', error: 'SYNTHETIC_ROW_MISSING' });
  expect(h.harness.getSnapshot().checks).toBeUndefined();
  expect(h.connections).toHaveLength(3);
  h.connections.forEach(connection => expect(connection.closeAsync).toHaveBeenCalledTimes(1));
});

test('cipher probe rejects a correct-key native read failure without publishing partial checks or native diagnostics', async () => {
  const privateDiagnostic = 'synthetic-private-native-diagnostic';
  const h = await setupCipherProbe({ failures: { correctKey: new Error(privateDiagnostic) } });
  await h.harness.probeCipher();
  expect(h.harness.getSnapshot()).toMatchObject({ status: 'error', error: 'OPERATION_FAILED' });
  expect(h.harness.getSnapshot().checks).toBeUndefined();
  expect(h.connections).toHaveLength(3);
  h.connections.forEach(connection => expect(connection.closeAsync).toHaveBeenCalledTimes(1));
  expect(JSON.stringify(h.harness.getSnapshot())).not.toContain(privateDiagnostic);
  expect(JSON.stringify(h.harness.getSnapshot())).not.toContain(h.expectedKey);
});

test.each([
  [0, null],
  [1, { cipher_version: '   ' }],
  [2, { cipher_version: 42 }],
] as const)('cipher probe requires SQLCipher capability on independent connection %s', async (connectionIndex, row) => {
  const h = await setupCipherProbe({ missingCapability: { connectionIndex, row } });
  await h.harness.probeCipher();
  expect(h.harness.getSnapshot()).toMatchObject({ status: 'error', error: 'SQLCIPHER_UNAVAILABLE' });
  expect(h.harness.getSnapshot().checks).toBeUndefined();
  expect(h.connections).toHaveLength(connectionIndex + 1);
  h.connections.forEach(connection => expect(connection.closeAsync).toHaveBeenCalledTimes(1));
  expect(h.connections[connectionIndex]!.execAsync).not.toHaveBeenCalled();
  expect(h.connections[connectionIndex]!.getFirstAsync).not.toHaveBeenCalledWith(SYNTHETIC_PROBE_READ);
});

test('cipher probe retries a failed close before any fresh probe and blocks opens while retry still fails', async () => {
  const h = await setupCipherProbe();
  const open = h.deps.native.openDatabaseAsync.getMockImplementation()!;
  const privateDiagnostic = 'synthetic-close-diagnostic';
  h.deps.native.openDatabaseAsync.mockImplementation(async name => {
    const connection = await open(name);
    if (h.connections.length === 1) {
      jest.mocked(connection.closeAsync)
        .mockImplementationOnce(async () => { h.order.push('close-failed'); throw new Error(privateDiagnostic); })
        .mockImplementationOnce(async () => { h.order.push('retry-failed'); throw new Error(privateDiagnostic); });
    }
    return connection;
  });
  const snapshots: string[] = [];
  const unsubscribe = h.harness.subscribe(() => snapshots.push(JSON.stringify(h.harness.getSnapshot())));
  await h.harness.probeCipher();
  await h.harness.probeCipher();
  expect(h.harness.getSnapshot()).toMatchObject({ status: 'error', error: 'OPERATION_FAILED' });
  expect(h.connections).toHaveLength(1);
  expect(h.order).toEqual(['open:0', 'close-failed', 'retry-failed']);
  await h.harness.probeCipher();
  unsubscribe();
  expect(h.harness.getSnapshot()).toMatchObject({ status: 'success', checks: { noKey: true, wrongKey: true, correctKey: true, cipherAvailable: true } });
  expect(h.connections).toHaveLength(4);
  expect(new Set(h.connections).size).toBe(4);
  expect(h.order).toEqual(['open:0', 'close-failed', 'retry-failed', 'close:0', 'open:1', 'close:1', 'open:2', 'close:2', 'open:3', 'close:3']);
  expect(h.connections[0]!.closeAsync).toHaveBeenCalledTimes(3);
  h.connections.slice(1).forEach(connection => expect(connection.closeAsync).toHaveBeenCalledTimes(1));
  expect(snapshots.join('\n')).not.toContain(privateDiagnostic);
  expect(snapshots.join('\n')).not.toContain(h.expectedKey);
  expect(snapshots.join('\n')).not.toContain('PRAGMA key');
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

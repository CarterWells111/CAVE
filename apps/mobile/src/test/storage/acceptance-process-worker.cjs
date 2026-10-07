// Test-only process worker: real SQLite durability, NOT SQLCipher or native iOS Keychain.
// Synthetic secrets are disk-backed solely to survive terminating this child process.
// The worker emits only states, booleans and counts, never SQL, keys or fixture text.
const { existsSync, readFileSync, writeFileSync, rmSync, realpathSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { basename, dirname, join } = require('node:path');

async function main() {
  const [directory, operation, stage] = process.argv.slice(2);
  if (dirname(realpathSync(directory)) !== realpathSync(tmpdir())
    || !/^cave-acceptance-process-[a-zA-Z0-9]+$/u.test(basename(directory))) {
    throw new Error('INVALID_SYNTHETIC_DIRECTORY');
  }
  const ts = require('typescript');
  require.extensions['.ts'] = (module, filename) => {
    const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    });
    module._compile(compiled.outputText, filename);
  };
  const { DatabaseSync } = require('node:sqlite');
  const { createAcceptanceHarness, ACCEPTANCE_DATABASE, ACCEPTANCE_PREFIX, DELETION_STAGES } = require('../../features/acceptance/acceptance-harness.ts');
  const { SECRET_NAMES } = require('../../core/storage/key-store.ts');
  const databasePath = join(directory, ACCEPTANCE_DATABASE);
  const profilePath = join(directory, 'synthetic-profiles');
  const allowedSecrets = new Set(Object.values(SECRET_NAMES).map((name) => ACCEPTANCE_PREFIX + name));
  let nativeOpenCount = 0;
  function secretPath(name) {
    if (!allowedSecrets.has(name)) throw new Error('INVALID_SYNTHETIC_SECRET');
    return join(directory, name);
  }
  function filePath(name) {
    if (![ACCEPTANCE_DATABASE, `${ACCEPTANCE_DATABASE}-wal`, `${ACCEPTANCE_DATABASE}-shm`].includes(name)) {
      throw new Error('INVALID_SYNTHETIC_DATABASE');
    }
    return join(directory, name);
  }
  const harness = createAcceptanceHarness({
    enabled: () => true,
    randomBytes: (length) => new Uint8Array(length).fill(7),
    secureStore: {
      async getItemAsync(name) { const path = secretPath(name); return existsSync(path) ? readFileSync(path, 'utf8') : null; },
      async setItemAsync(name, value) { writeFileSync(secretPath(name), value); },
      async deleteItemAsync(name) { rmSync(secretPath(name), { force: true }); },
    },
    profiles: {
      async exists() { return existsSync(profilePath); },
      async seed() { writeFileSync(profilePath, 'synthetic profile marker'); },
      async clearAll() { rmSync(profilePath, { force: true }); },
    },
    files: {
      coordinationKey: directory,
      async databaseExists(name) { return existsSync(filePath(name)); },
      async removeDatabaseFiles(name) {
        filePath(name);
        for (const suffix of ['', '-wal', '-shm']) rmSync(databasePath + suffix, { force: true });
      },
    },
    native: {
      async openDatabaseAsync(name) {
        const db = new DatabaseSync(filePath(name));
        nativeOpenCount += 1;
        return {
          async execAsync(sql) {
            // SQLite has no encryption: ignore synthetic key SQL and explicitly simulate capability.
            if (!sql.startsWith('PRAGMA key')) db.exec(sql);
          },
          async runAsync(sql, ...params) { return { changes: Number(db.prepare(sql).run(...params).changes) }; },
          async getAllAsync(sql, ...params) { return db.prepare(sql).all(...params); },
          async getFirstAsync(sql, ...params) {
            if (sql === 'PRAGMA cipher_version') return { cipher_version: 'SIMULATED-NOT-ENCRYPTED' };
            return db.prepare(sql).get(...params) ?? null;
          },
          async closeAsync() { db.close(); },
        };
      },
    },
  });
  const send = (message) => new Promise((resolve, reject) => {
    process.send(message, (error) => error ? reject(new Error('IPC_FAILED')) : resolve());
  });
  function assertSucceeded() {
    if (harness.getSnapshot().status !== 'success') throw new Error('HARNESS_OPERATION_FAILED');
  }
  async function seed() { await harness.createFixture('v11'); assertSucceeded(); }
  async function stopAt(action) {
    const unsubscribe = harness.subscribe(() => {
      const state = harness.getSnapshot();
      if (state.status !== 'paused') return;
      unsubscribe();
      // Keep the transaction and child alive until the parent forcefully kills it.
      setInterval(() => {}, 1_000);
      void send({ kind: 'paused', state });
    });
    await action();
    throw new Error('EXPECTED_PAUSE_NOT_REACHED');
  }
  if (operation === 'pause-migration') {
    await seed();
    await stopAt(() => harness.upgrade('pause'));
  } else if (operation === 'recover-migration') {
    await harness.startup(); assertSucceeded();
    const before = harness.getSnapshot();
    const db = new DatabaseSync(databasePath);
    const ownershipColumnsBefore = db.prepare('PRAGMA table_info(journal_records)').all()
      .filter((column) => column.name === 'owner_account_id').length;
    db.close();
    await harness.upgrade(); assertSucceeded();
    await send({ kind: 'result', before, state: harness.getSnapshot(), ownershipColumnsBefore });
  } else if (operation === 'pause-deletion') {
    if (!DELETION_STAGES.includes(stage)) throw new Error('INVALID_STAGE');
    await seed();
    await harness.upgrade(); assertSucceeded();
    // Orphan sidecars are synthetic sentinels. Deletion must remove them without reopening SQLite.
    writeFileSync(databasePath + '-wal', 'synthetic orphan WAL');
    writeFileSync(databasePath + '-shm', 'synthetic orphan SHM');
    await stopAt(() => harness.deleteSyntheticData(stage));
  } else if (operation === 'recover-deletion') {
    await harness.startup(); assertSucceeded();
    const startup = harness.getSnapshot();
    await harness.inspect(); assertSucceeded();
    await send({ kind: 'result', startup, state: harness.getSnapshot(), nativeOpenCount });
  } else throw new Error('INVALID_OPERATION');
}

main().then(() => process.exit(0), () => {
  // Do not forward native exception messages, which can contain paths, SQL and keys.
  if (process.connected) process.send({ kind: 'failed' }, () => process.exit(1));
  else process.exit(1);
});

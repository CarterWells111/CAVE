/** @jest-environment node */
// Real child-process termination and disk-backed SQLite, NOT SQLCipher encryption,
// native iOS Keychain, physical device termination or power-loss durability.
import { fork, type ChildProcess } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { DELETION_STAGES, type AcceptanceState } from './acceptance-harness';

type WorkerMessage = {
  kind: 'paused' | 'result' | 'failed';
  state?: AcceptanceState;
  before?: AcceptanceState;
  startup?: AcceptanceState;
  ownershipColumnsBefore?: number;
  nativeOpenCount?: number;
};
const worker = join(__dirname, '../../test/storage/acceptance-process-worker.cjs');
const directories: string[] = [];
const children = new Set<ChildProcess>();
const emptyMetadata = {
  databasePresent: false, walPresent: false, shmPresent: false, profilePresent: false,
  keyPresent: false, deletionPending: false, tokenPresent: false, sessionPresent: false, adultPresent: false,
};
const fixtureCounts = {
  course_progress: 1, saved_records: 1, journey_drafts: 1, journey_drafts_v2: 1,
  journey_drafts_v3: 1, journey_drafts_v4: 1, journey_review_versions: 2,
  journal_records: 1, journal_entries: 1, journal_period_reviews: 1,
};

function createDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'cave-acceptance-process-'));
  directories.push(directory);
  return directory;
}
function launch(directory: string, operation: string, stage = '') {
  const child = fork(worker, [directory, operation, stage], {
    execPath: process.execPath,
    execArgv: ['--experimental-sqlite', '--no-warnings'],
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  children.add(child);
  const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.once('close', (code, signal) => { children.delete(child); resolve({ code, signal }); });
  });
  const message = new Promise<WorkerMessage>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Synthetic child did not reach the expected stage')), 20_000);
    child.once('message', (value: WorkerMessage) => {
      clearTimeout(timeout);
      if (value.kind === 'failed') reject(new Error('Synthetic child operation failed'));
      else resolve(value);
    });
    child.once('error', () => { clearTimeout(timeout); reject(new Error('Unable to launch synthetic child')); });
    child.once('close', () => { clearTimeout(timeout); reject(new Error('Synthetic child exited before reporting a result')); });
  });
  return { child, message, closed };
}
async function killAtPause(directory: string, operation: string, expectedStage: string) {
  const run = launch(directory, operation, operation === 'pause-deletion' ? expectedStage : '');
  expect(await run.message).toMatchObject({ kind: 'paused', state: { status: 'paused', busy: true, stage: expectedStage } });
  expect(run.child.exitCode).toBeNull();
  expect(run.child.kill('SIGKILL')).toBe(true);
  const exit = await run.closed;
  // Windows force-termination reports a nonzero code; POSIX reports SIGKILL.
  expect(exit.signal === 'SIGKILL' || (exit.code !== null && exit.code !== 0)).toBe(true);
}
async function recover(directory: string, operation: string) {
  const run = launch(directory, operation);
  const message = await run.message;
  expect(await run.closed).toEqual({ code: 0, signal: null });
  expect(message.kind).toBe('result');
  return message;
}

afterEach(async () => {
  const pending = [...children].map((child) => new Promise<void>((resolve) => {
    child.once('close', () => resolve());
    child.kill('SIGKILL');
  }));
  await Promise.all(pending);
  for (const directory of directories.splice(0)) {
    // Recursive removal is confined to a directory returned by this test's mkdtemp.
    expect(dirname(realpathSync(directory))).toBe(realpathSync(tmpdir()));
    expect(basename(directory)).toMatch(/^cave-acceptance-process-[a-zA-Z0-9]+$/u);
    rmSync(directory, { recursive: true, force: true });
  }
});

test('killed pre-commit migration rolls back on disk; a fresh process preserves fixtures and upgrades to v13', async () => {
  const directory = createDirectory();
  await killAtPause(directory, 'pause-migration', 'migration-v12-before-commit');
  const result = await recover(directory, 'recover-migration');
  expect(result.before).toMatchObject({ status: 'success', metadata: { version: 11, counts: fixtureCounts } });
  expect(result.ownershipColumnsBefore).toBe(0);
  expect(result.state).toMatchObject({ status: 'success', metadata: { version: 13, counts: fixtureCounts } });
}, 60_000);

test.each(DELETION_STAGES)('fresh startup completes deletion after force-termination at %s', async (stage) => {
  const directory = createDirectory();
  await killAtPause(directory, 'pause-deletion', stage);
  const result = await recover(directory, 'recover-deletion');
  expect(result.startup).toMatchObject({ status: 'success', metadata: emptyMetadata });
  expect(result.state).toMatchObject({ status: 'success', metadata: emptyMetadata });
  // Pending deletion must be completed before any database opening or recreation.
  expect(result.nativeOpenCount).toBe(0);
}, 60_000);

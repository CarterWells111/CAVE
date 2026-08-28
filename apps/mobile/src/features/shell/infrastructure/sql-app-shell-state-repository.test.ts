import type { DatabaseConnection, EncryptedDatabaseManager } from "../../../core/storage/database";
import type { AppShellState } from "../domain/app-shell-state";
import { SqlAppShellStateRepository } from "./sql-app-shell-state-repository";

const firstCompletion: AppShellState = {
  initialJourneyId: "journey-first",
  initialJourneyCompletedAt: "2026-08-27T12:00:00.000Z"
};

function makeHarness() {
  let stored: AppShellState | null = null;
  const runAsync = jest.fn(async (sql: string, ...params: unknown[]) => {
    if (sql.startsWith("INSERT") && stored === null) {
      stored = {
        initialJourneyCompletedAt: params[0] as string,
        initialJourneyId: params[1] as string
      };
      return { changes: 1 };
    }
    if (sql.startsWith("DELETE")) {
      stored = null;
      return { changes: 1 };
    }
    return { changes: 0 };
  });
  const getFirstAsync = jest.fn(async (sql: string, ...params: unknown[]) => {
    void sql;
    void params;
    return stored === null ? null : {
      initial_journey_completed_at: stored.initialJourneyCompletedAt,
      initial_journey_id: stored.initialJourneyId
    };
  });
  const connection = {
    execAsync: jest.fn(async () => undefined),
    runAsync,
    getAllAsync: jest.fn(async () => []),
    getFirstAsync,
    closeAsync: jest.fn(async () => undefined)
  } as unknown as DatabaseConnection;
  const database = {
    initialize: jest.fn(async () => connection),
    close: jest.fn(async () => undefined),
    removeDatabaseFiles: jest.fn(async () => undefined),
    withExclusiveMaintenance: jest.fn()
  } satisfies EncryptedDatabaseManager;
  return { connection, database, getFirstAsync, runAsync };
}

test("loads null without selecting a journey payload", async () => {
  const { database, getFirstAsync } = makeHarness();
  const repository = new SqlAppShellStateRepository(database);

  await expect(repository.load()).resolves.toBeNull();

  const sql = getFirstAsync.mock.calls[0]?.[0] ?? "";
  expect(sql).toContain("initial_journey_id");
  expect(sql).toContain("initial_journey_completed_at");
  expect(sql).not.toMatch(/payload|journal|communication_card/iu);
});

test("inserts the singleton once and never overwrites the first completion", async () => {
  const { database, runAsync } = makeHarness();
  const repository = new SqlAppShellStateRepository(database);

  await expect(repository.completeInitialJourney(firstCompletion)).resolves.toEqual(firstCompletion);
  await expect(repository.completeInitialJourney({
    initialJourneyId: "journey-later",
    initialJourneyCompletedAt: "2026-08-28T12:00:00.000Z"
  })).resolves.toEqual(firstCompletion);

  expect(runAsync).toHaveBeenNthCalledWith(
    1,
    expect.stringContaining("ON CONFLICT(singleton_id) DO NOTHING"),
    firstCompletion.initialJourneyCompletedAt,
    firstCompletion.initialJourneyId
  );
  await expect(repository.load()).resolves.toEqual(firstCompletion);
});

test("clears the singleton marker", async () => {
  const { database, runAsync } = makeHarness();
  const repository = new SqlAppShellStateRepository(database);
  await repository.completeInitialJourney(firstCompletion);

  await repository.clear();

  expect(runAsync).toHaveBeenLastCalledWith(
    "DELETE FROM app_shell_state WHERE singleton_id = 1"
  );
  await expect(repository.load()).resolves.toBeNull();
});

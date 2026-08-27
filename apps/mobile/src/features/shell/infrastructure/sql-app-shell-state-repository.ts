import type { EncryptedDatabaseManager } from "../../../core/storage/database";
import type { AppShellState } from "../domain/app-shell-state";
import type { AppShellStateRepository } from "./app-shell-state-repository";

type AppShellStateRow = {
  initial_journey_id: string;
  initial_journey_completed_at: string;
};

export class SqlAppShellStateRepository implements AppShellStateRepository {
  constructor(private readonly database: EncryptedDatabaseManager) {}

  async load(): Promise<AppShellState | null> {
    const connection = await this.database.initialize();
    const row = await connection.getFirstAsync<AppShellStateRow>(
      "SELECT initial_journey_id, initial_journey_completed_at FROM app_shell_state WHERE singleton_id = 1"
    );
    return row === null ? null : {
      initialJourneyId: row.initial_journey_id,
      initialJourneyCompletedAt: row.initial_journey_completed_at
    };
  }

  async completeInitialJourney(state: AppShellState): Promise<AppShellState> {
    const connection = await this.database.initialize();
    await connection.runAsync(
      "INSERT INTO app_shell_state (singleton_id, initial_journey_completed_at, initial_journey_id) VALUES (1, ?, ?) ON CONFLICT(singleton_id) DO NOTHING",
      state.initialJourneyCompletedAt,
      state.initialJourneyId
    );
    const persisted = await this.load();
    if (persisted === null) throw new Error("app-shell-state-write-failed");
    return persisted;
  }

  async clear(): Promise<void> {
    const connection = await this.database.initialize();
    await connection.runAsync("DELETE FROM app_shell_state WHERE singleton_id = 1");
  }
}

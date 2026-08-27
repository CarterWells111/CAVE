import type { AppShellState } from "../domain/app-shell-state";

export interface AppShellStateRepository {
  load(): Promise<AppShellState | null>;
  completeInitialJourney(state: AppShellState): Promise<AppShellState>;
  clear(): Promise<void>;
}

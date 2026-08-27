import type { AppShellState } from "../domain/app-shell-state";
import type { AppShellStateRepository } from "./app-shell-state-repository";

function clone(state: AppShellState): AppShellState {
  return { ...state };
}

export class InMemoryAppShellStateRepository implements AppShellStateRepository {
  private state: AppShellState | null;

  constructor(initialState: AppShellState | null = null) {
    this.state = initialState === null ? null : clone(initialState);
  }

  async load(): Promise<AppShellState | null> {
    return this.state === null ? null : clone(this.state);
  }

  async completeInitialJourney(state: AppShellState): Promise<AppShellState> {
    this.state ??= clone(state);
    return clone(this.state);
  }

  async clear(): Promise<void> {
    this.state = null;
  }
}

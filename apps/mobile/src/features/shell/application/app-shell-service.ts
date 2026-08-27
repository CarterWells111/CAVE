import type { AppShellState } from "../domain/app-shell-state";
import type { AppShellStateRepository } from "../infrastructure/app-shell-state-repository";

export type AppShellServiceErrorCode =
  | "app-shell-load-failed"
  | "app-shell-complete-failed"
  | "app-shell-clear-failed";

export class AppShellServiceError extends Error {
  constructor(readonly code: AppShellServiceErrorCode) {
    super("App shell state is unavailable.");
    this.name = "AppShellServiceError";
  }
}

export type AppShellSnapshot =
  | Readonly<{ status: "idle"; completion: null }>
  | Readonly<{ status: "ready"; completion: AppShellState | null }>
  | Readonly<{
      status: "error";
      completion: AppShellState | null;
      error: Readonly<{ code: AppShellServiceErrorCode }>;
    }>;

export type ShellLaunchPath = "/journey/welcome" | "/(tabs)";
export type ShellLongTermPath =
  | "/(tabs)"
  | `/(tabs)/${string}`
  | "/settings"
  | `/settings/${string}`;

function cloneCompletion(completion: AppShellState | null): AppShellState | null {
  return completion === null ? null : { ...completion };
}

function cloneSnapshot(snapshot: AppShellSnapshot): AppShellSnapshot {
  if (snapshot.status === "idle") return snapshot;
  if (snapshot.status === "ready") {
    return { status: "ready", completion: cloneCompletion(snapshot.completion) };
  }
  return {
    status: "error",
    completion: cloneCompletion(snapshot.completion),
    error: { ...snapshot.error },
  };
}

export function resolveShellLaunchPath(
  snapshot: Pick<AppShellSnapshot, "completion">,
): ShellLaunchPath {
  return snapshot.completion === null ? "/journey/welcome" : "/(tabs)";
}

export function guardLongTermPath<Path extends ShellLongTermPath>(
  snapshot: Pick<AppShellSnapshot, "completion">,
  requestedPath: Path,
): Path | "/journey/welcome" {
  return snapshot.completion === null ? "/journey/welcome" : requestedPath;
}

export function isActiveLongTermReview(
  draft: Readonly<{ id: string }> | null,
  completion: AppShellState | null,
): boolean {
  return draft !== null
    && completion !== null
    && draft.id !== completion.initialJourneyId;
}

export class AppShellService {
  private snapshot: AppShellSnapshot = { status: "idle", completion: null };

  constructor(private readonly repository: AppShellStateRepository) {}

  getSnapshot(): AppShellSnapshot {
    return cloneSnapshot(this.snapshot);
  }

  initialize(): Promise<AppShellSnapshot> {
    if (this.snapshot.status !== "idle") return Promise.resolve(this.getSnapshot());
    return this.refresh();
  }

  async refresh(): Promise<AppShellSnapshot> {
    const previous = this.snapshot.completion;
    try {
      const completion = await this.repository.load();
      this.snapshot = { status: "ready", completion: cloneCompletion(completion) };
      return this.getSnapshot();
    } catch {
      throw this.fail("app-shell-load-failed", previous);
    }
  }

  async complete(state: AppShellState): Promise<AppShellSnapshot> {
    const previous = this.snapshot.completion;
    try {
      const completion = await this.repository.completeInitialJourney({ ...state });
      this.snapshot = { status: "ready", completion: cloneCompletion(completion) };
      return this.getSnapshot();
    } catch {
      throw this.fail("app-shell-complete-failed", previous);
    }
  }

  async clear(): Promise<AppShellSnapshot> {
    const previous = this.snapshot.completion;
    try {
      await this.repository.clear();
      this.snapshot = { status: "ready", completion: null };
      return this.getSnapshot();
    } catch {
      throw this.fail("app-shell-clear-failed", previous);
    }
  }

  private fail(code: AppShellServiceErrorCode, completion: AppShellState | null) {
    this.snapshot = { status: "error", completion: cloneCompletion(completion), error: { code } };
    return new AppShellServiceError(code);
  }
}

import type { AppShellState } from "../domain/app-shell-state";
import type { AppShellStateRepository } from "../infrastructure/app-shell-state-repository";
import {
  AppShellService,
  AppShellServiceError,
  guardLongTermPath,
  isActiveLongTermReview,
  resolveShellLaunchPath,
} from "./app-shell-service";

const firstCompletion: AppShellState = {
  initialJourneyId: "journey-first",
  initialJourneyCompletedAt: "2026-08-27T12:00:00.000Z",
};

function harness(initial: AppShellState | null = null) {
  let stored = initial;
  const repository: AppShellStateRepository = {
    load: jest.fn(async () => stored),
    completeInitialJourney: jest.fn(async (state) => {
      stored ??= state;
      return stored;
    }),
    clear: jest.fn(async () => { stored = null; }),
  };
  return {
    repository,
    service: new AppShellService(repository),
    setStored: (state: AppShellState | null) => { stored = state; },
  };
}

test("initializes and refreshes the persisted completion snapshot", async () => {
  const { repository, service, setStored } = harness();

  await expect(service.initialize()).resolves.toEqual({ status: "ready", completion: null });
  expect(resolveShellLaunchPath(service.getSnapshot())).toBe("/journey/welcome");

  setStored(firstCompletion);
  await expect(service.refresh()).resolves.toEqual({ status: "ready", completion: firstCompletion });
  expect(resolveShellLaunchPath(service.getSnapshot())).toBe("/(tabs)");
  expect(repository.load).toHaveBeenCalledTimes(2);
});

test("treats a later draft as active without mistaking the completed initial journey for one", () => {
  expect(isActiveLongTermReview(null, firstCompletion)).toBe(false);
  expect(isActiveLongTermReview({ id: "journey-first" }, firstCompletion)).toBe(false);
  expect(isActiveLongTermReview({ id: "review-later" }, firstCompletion)).toBe(true);
  expect(isActiveLongTermReview({ id: "review-later" }, null)).toBe(false);
});

test("completes once, refreshes from the repository result, and clears", async () => {
  const { repository, service } = harness();
  const laterCompletion: AppShellState = {
    initialJourneyId: "journey-later",
    initialJourneyCompletedAt: "2026-08-28T12:00:00.000Z",
  };

  await expect(service.complete(firstCompletion)).resolves.toEqual({ status: "ready", completion: firstCompletion });
  await expect(service.complete(laterCompletion)).resolves.toEqual({ status: "ready", completion: firstCompletion });
  expect(repository.completeInitialJourney).toHaveBeenNthCalledWith(1, firstCompletion);
  expect(repository.completeInitialJourney).toHaveBeenNthCalledWith(2, laterCompletion);

  await expect(service.clear()).resolves.toEqual({ status: "ready", completion: null });
  expect(repository.clear).toHaveBeenCalledTimes(1);
});

test("guards long-term tabs while keeping settings available before completion", () => {
  const incomplete = { status: "ready", completion: null } as const;
  const completed = { status: "ready", completion: firstCompletion } as const;

  expect(resolveShellLaunchPath(incomplete)).toBe("/journey/welcome");
  expect(resolveShellLaunchPath(completed)).toBe("/(tabs)");
  expect(guardLongTermPath(incomplete, "/(tabs)/reviews")).toBe("/journey/welcome");
  expect(guardLongTermPath(incomplete, "/settings/privacy")).toBe("/settings/privacy");
  expect(guardLongTermPath(completed, "/(tabs)/reviews")).toBe("/(tabs)/reviews");
  expect(guardLongTermPath(completed, "/settings/privacy")).toBe("/settings/privacy");

  const unrelatedActiveJourney = { currentPage: "reflection", privateText: "must-not-affect-launch" };
  void unrelatedActiveJourney;
  expect(resolveShellLaunchPath(completed)).toBe("/(tabs)");
});

test.each([
  ["load", "app-shell-load-failed"],
  ["completeInitialJourney", "app-shell-complete-failed"],
  ["clear", "app-shell-clear-failed"],
] as const)("exposes a typed safe error when repository %s fails", async (method, code) => {
  const { repository, service } = harness(method === "clear" ? firstCompletion : null);
  (repository[method] as jest.Mock).mockRejectedValueOnce(
    new Error("private journal and card values must not escape"),
  );

  const operation = method === "load"
    ? service.initialize()
    : method === "completeInitialJourney"
      ? service.complete(firstCompletion)
      : service.clear();

  await expect(operation).rejects.toEqual(new AppShellServiceError(code));
  expect(service.getSnapshot()).toMatchObject({ status: "error", error: { code } });
  expect(JSON.stringify(service.getSnapshot())).not.toMatch(/private journal|card values/u);
});

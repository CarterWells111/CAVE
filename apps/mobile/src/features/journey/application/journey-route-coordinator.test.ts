import { createJourneyDraft, type JourneyDraft } from "../domain/types";
import type { JourneyApplicationService } from "./journey-application-service";
import { JourneyRouteCoordinator } from "./journey-route-coordinator";

function activeDraft(currentPage: JourneyDraft["currentPage"] = "reflection"): JourneyDraft {
  return {
    ...createJourneyDraft({ id: "journey-1", now: "now" }),
    ageConfirmed: true,
    currentPage
  };
}

function harness(snapshot: JourneyDraft | null = activeDraft()) {
  const navigateTo = jest.fn(async () => undefined);
  const resetJourney = jest.fn(async () => undefined);
  const service: JourneyApplicationService = {
    getSnapshot: jest.fn(() => snapshot),
    confirmAdult: jest.fn(async () => undefined),
    dispatch: jest.fn(async () => undefined),
    navigateTo,
    resetJourney
  };
  const router = {
    replace: jest.fn(),
    push: jest.fn()
  };
  return { coordinator: new JourneyRouteCoordinator(service, router), navigateTo, resetJourney, router, service };
}

test("guards adult-only routes before rendering and leaves welcome accessible", () => {
  const { coordinator } = harness(null);

  expect(coordinator.guard("welcome")).toBe(true);
  expect(coordinator.guard("overnight")).toBe(false);
});

test("persists the target page before replacing the route for next and back", async () => {
  const { coordinator, navigateTo, router, service } = harness();

  await coordinator.goTo("preset-practice");
  await coordinator.backFrom("reflection");

  expect(service.navigateTo).toHaveBeenNthCalledWith(1, "preset-practice");
  expect(router.replace).toHaveBeenNthCalledWith(1, "/journey/preset-practice");
  expect(service.navigateTo).toHaveBeenNthCalledWith(2, "behavior-attitudes");
  expect(router.replace).toHaveBeenNthCalledWith(2, "/journey/behavior-attitudes");
  expect(navigateTo.mock.invocationCallOrder[0]).toBeLessThan(router.replace.mock.invocationCallOrder[0]!);
});

test("resumes at the snapshot page and restarts only after deleting the active draft", async () => {
  const { coordinator, resetJourney, router, service } = harness(activeDraft("checklist"));

  coordinator.resume();
  await coordinator.restart();

  expect(router.replace).toHaveBeenNthCalledWith(1, "/journey/checklist");
  expect(service.resetJourney).toHaveBeenCalledTimes(1);
  expect(router.replace).toHaveBeenNthCalledWith(2, "/journey/welcome");
  expect(resetJourney.mock.invocationCallOrder[0]).toBeLessThan(router.replace.mock.invocationCallOrder[1]!);
});

test("does not navigate back before Page 1", async () => {
  const { coordinator, router, service } = harness(activeDraft("welcome"));

  await coordinator.backFrom("welcome");

  expect(service.navigateTo).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
});

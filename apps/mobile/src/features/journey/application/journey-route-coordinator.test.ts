import { createJourneyDraft, type JourneyDraft } from "../domain/types";
import type { JourneyApplicationService } from "./journey-application-service";
import { JourneyRouteCoordinator } from "./journey-route-coordinator";

function activeDraft(currentPage: JourneyDraft["currentPage"] = "reflection"): JourneyDraft {
  return {
    ...createJourneyDraft({ id: "journey-1", now: "now" }),
    ageConfirmed: true,
    addressPreference: "你",
    prefaceRead: true,
    overnight: { stage: "concerns", resumeStage: "concerns" },
    pointEventKeys: ["progress:overnight-complete:v1"],
    readKnowledgeCardIds: ["draft-knowledge-body-signals", "draft-knowledge-consent", "draft-knowledge-health"],
    explicitContentConsent: false,
    behaviorAttitudes: Object.fromEntries([
      "behavior-hug", "draft-kissing", "behavior-same-bed", "behavior-my-nudity",
      "behavior-partner-nudity", "behavior-over-clothes-touch", "behavior-direct-touch",
    ].map((id) => [id, "skip" as const])),
    journal: { text: "", saveChoice: "not-saved" },
    practice: { completed: true, mirrorRehearsed: false },
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

test("guards content routes until onboarding prerequisites are present", () => {
  const { coordinator } = harness(null);

  expect(coordinator.guard("body-knowledge")).toBe(false);
  expect(coordinator.guard("overnight")).toBe(false);
});

test("persists the target page before replacing the route for next and back", async () => {
  const { coordinator, navigateTo, router, service } = harness();

  await coordinator.goTo("preset-practice");
  await coordinator.backFrom("reflection");

  expect(service.navigateTo).toHaveBeenNthCalledWith(1, "preset-practice");
  expect(router.replace).toHaveBeenNthCalledWith(1, "/journey/preset-practice");
  expect(service.navigateTo).toHaveBeenNthCalledWith(2, "behavior-map");
  expect(router.replace).toHaveBeenNthCalledWith(2, "/journey/behavior-map");
  expect(navigateTo.mock.invocationCallOrder[0]).toBeLessThan(router.replace.mock.invocationCallOrder[0]!);
});

test("refuses to persist or render a future route whose prerequisites are missing", async () => {
  const adultOnly = { ...createJourneyDraft({ id: "journey-locked", now: "now" }), ageConfirmed: true };
  const { coordinator, router, service } = harness(adultOnly);

  await expect(coordinator.goTo("final-preparation")).rejects.toThrow("journey-page-locked:final-preparation");
  expect(service.navigateTo).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
});

test("resumes at the snapshot page and restarts only after deleting the active draft", async () => {
  const { coordinator, resetJourney, router, service } = harness(activeDraft("final-preparation"));

  coordinator.resume();
  await coordinator.restart();

  expect(router.replace).toHaveBeenNthCalledWith(1, "/journey/final-preparation");
  expect(service.resetJourney).toHaveBeenCalledTimes(1);
  expect(router.replace).toHaveBeenNthCalledWith(2, "/journey/welcome");
  expect(resetJourney.mock.invocationCallOrder[0]).toBeLessThan(router.replace.mock.invocationCallOrder[1]!);
});

test("does not navigate back before Page 1", async () => {
  const { coordinator, router, service } = harness(activeDraft("body-knowledge"));

  await coordinator.backFrom("body-knowledge");

  expect(service.navigateTo).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
});

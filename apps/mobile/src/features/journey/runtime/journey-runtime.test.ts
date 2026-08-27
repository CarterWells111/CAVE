import type { ClipboardAdapter } from "../application/page-controllers";
import {
  createJourneyRuntime,
  resolveJourneyRuntimeMode,
  type JourneyRuntime
} from "./journey-runtime";

const clipboard: ClipboardAdapter = {
  setStringAsync: jest.fn(async () => undefined)
};

test("maps only the Expo store client to the memory-only demo runtime", () => {
  expect(resolveJourneyRuntimeMode("storeClient")).toBe("expo-go-demo");
  expect(resolveJourneyRuntimeMode("standalone")).toBe("native-secure");
  expect(resolveJourneyRuntimeMode("bare")).toBe("native-secure");
});

test("composes Expo Go without touching the native secure runtime factory", async () => {
  const createNativeRuntime = jest.fn<Promise<JourneyRuntime>, []>();

  const runtime = await createJourneyRuntime({
    executionEnvironment: "storeClient",
    clipboard,
    createId: () => "journey-demo-1",
    now: () => "2026-08-27T12:00:00.000Z",
    createNativeRuntime
  });

  expect(runtime).toMatchObject({
    mode: "expo-go-demo",
    persistence: "memory-only"
  });
  expect(createNativeRuntime).not.toHaveBeenCalled();

  await runtime.service.confirmAdult();
  expect(runtime.service.getSnapshot()).toMatchObject({ id: "journey-demo-1", ageConfirmed: true });
});

test("uses the secure runtime factory for Development and Preview without a memory fallback", async () => {
  const failure = new Error("secure-runtime-unavailable");
  const createNativeRuntime = jest.fn(async () => {
    throw failure;
  });

  await expect(createJourneyRuntime({
    executionEnvironment: "standalone",
    clipboard,
    createId: () => "unused",
    now: () => "2026-08-27T12:00:00.000Z",
    createNativeRuntime
  })).rejects.toBe(failure);

  expect(createNativeRuntime).toHaveBeenCalledTimes(1);
});

test("deletes the Expo Go draft, cards, and completion marker together", async () => {
  const runtime = await createJourneyRuntime({
    executionEnvironment: "storeClient",
    clipboard,
    createId: () => "delete-all-journey",
    now: () => "2026-08-27T12:00:00.000Z",
    createNativeRuntime: jest.fn()
  });
  await runtime.service.confirmAdult();
  const draft = runtime.service.getSnapshot();
  if (draft === null) throw new Error("missing draft");
  await runtime.cards.save({ id: "card-1", journeyId: draft.id, card: draft.communicationCard, savedAt: draft.updatedAt });
  await runtime.shellState.completeInitialJourney({ initialJourneyId: draft.id, initialJourneyCompletedAt: draft.updatedAt });

  await runtime.deleteAllData();

  expect(runtime.service.getSnapshot()).toBeNull();
  await expect(runtime.cards.listMetadata()).resolves.toEqual([]);
  await expect(runtime.shellState.load()).resolves.toBeNull();
});

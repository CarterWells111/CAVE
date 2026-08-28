import type { ClipboardAdapter } from "../application/page-controllers";
import { createJourneyDraft } from "../domain/types";
import { InMemoryCommunicationCardRepository, InMemoryJourneyDraftRepository } from "../infrastructure/in-memory-journey-repositories";
import {
  composeJourneyRuntime,
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

  await expect(runtime.appearancePreferences.load()).resolves.toBe("system");
  await runtime.appearancePreferences.save("light");
  await expect(runtime.appearancePreferences.load()).resolves.toBe("light");

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

test("deletes the Expo Go draft, cards, completion marker, and device privacy preference together", async () => {
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
  await runtime.appearancePreferences.save("dark");
  await runtime.privacySettings.setPrivacySettings({
    defaultSaveTranscript: false,
    liveModelAcknowledged: false,
    showLocalJournalSaveNotice: false,
  });

  await runtime.deleteAllData();

  expect(runtime.service.getSnapshot()).toBeNull();
  await expect(runtime.cards.listMetadata()).resolves.toEqual([]);
  await expect(runtime.shellState.load()).resolves.toBeNull();
  await expect(runtime.appearancePreferences.load()).resolves.toBe("system");
  await expect(runtime.privacySettings.getPrivacySettings()).resolves.toEqual({
    defaultSaveTranscript: false,
    liveModelAcknowledged: false,
    showLocalJournalSaveNotice: true,
  });
});

test("archives a completed review version and clears the active draft", async () => {
  const runtime = await createJourneyRuntime({
    executionEnvironment: "storeClient", clipboard,
    createId: () => "completed-journey", now: () => "2026-08-27T12:00:00.000Z",
    createNativeRuntime: jest.fn(),
  });
  await runtime.service.confirmAdult();
  const draft = runtime.service.getSnapshot();
  if (draft === null) throw new Error("missing draft");

  await runtime.controller.completeInitialJourney();

  expect(runtime.service.getSnapshot()).toBeNull();
  await expect(runtime.reviewHistory.listMetadata()).resolves.toEqual([
    expect.objectContaining({ id: "review:completed-journey:completed", status: "completed" }),
  ]);
  await expect(runtime.shellState.load()).resolves.toMatchObject({ initialJourneyId: "completed-journey" });
});

test("archives the one active draft before an explicitly confirmed replacement", async () => {
  const runtime = await createJourneyRuntime({
    executionEnvironment: "storeClient", clipboard,
    createId: () => "replaced-journey", now: () => "2026-08-27T12:00:00.000Z",
    createNativeRuntime: jest.fn(),
  });
  await runtime.service.confirmAdult();
  await runtime.replaceActiveReview();
  expect(runtime.service.getSnapshot()).toBeNull();
  await expect(runtime.reviewHistory.listMetadata()).resolves.toEqual([
    expect.objectContaining({ id: "review:replaced-journey:incomplete", status: "incomplete" }),
  ]);
});

test("archives a v4-era active draft even before the v5 active singleton has been backfilled", async () => {
  const drafts = new InMemoryJourneyDraftRepository();
  const legacy = { ...createJourneyDraft({ id: "legacy-active", now: "2026-08-20T12:00:00.000Z" }), ageConfirmed: true };
  await drafts.saveActive(legacy);
  const runtime = composeJourneyRuntime({ mode: "expo-go-demo", persistence: "memory-only", drafts,
    cards: new InMemoryCommunicationCardRepository(), clipboard, createId: () => "unused", now: () => "2026-08-27T12:00:00.000Z" });
  await runtime.service.initialize();
  expect(await runtime.reviewHistory.loadActive()).toBeNull();
  await runtime.replaceActiveReview();
  await expect(runtime.reviewHistory.listMetadata()).resolves.toEqual([
    expect.objectContaining({ id: "review:legacy-active:incomplete", status: "incomplete" }),
  ]);
});

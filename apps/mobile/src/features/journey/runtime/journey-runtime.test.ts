import type { ClipboardAdapter } from "../application/page-controllers";
import { createJourneyDraft } from "../domain/types";
import { InMemoryCommunicationCardRepository, InMemoryJourneyDraftRepository } from "../infrastructure/in-memory-journey-repositories";
import { InMemoryJournalRepository } from "../../journal/infrastructure/in-memory-journal-repository";
import {
  composeJourneyRuntime,
  createJourneyRuntime,
  resolveJourneyRuntimeMode,
  type JourneyRuntime
} from "./journey-runtime";

const clipboard: ClipboardAdapter = {
  setStringAsync: jest.fn(async () => undefined)
};

const createFreshExpoGoJournalRepository = async () => new InMemoryJournalRepository();

type ExpoGoJournalRuntimeDependencies = Parameters<typeof createJourneyRuntime>[0] & {
  createExpoGoJournalRepository(): Promise<InMemoryJournalRepository>;
};

function createExpoGoRuntime(
  repository: InMemoryJournalRepository,
  createId: () => string,
  now: () => string,
): Promise<JourneyRuntime> {
  return createJourneyRuntime({
    executionEnvironment: "storeClient",
    clipboard,
    createId,
    now,
    createNativeRuntime: jest.fn(),
    createExpoGoJournalRepository: async () => repository,
  } as ExpoGoJournalRuntimeDependencies);
}

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
    createNativeRuntime,
    createExpoGoJournalRepository: async () => new InMemoryJournalRepository(),
  });

  expect(runtime).toMatchObject({
    mode: "expo-go-demo",
    persistence: "memory-only",
    journalPersistence: "plaintext-sqlite",
  });
  expect(createNativeRuntime).not.toHaveBeenCalled();

  await expect(runtime.appearancePreferences.load()).resolves.toBe("system");
  await runtime.appearancePreferences.save("light");
  await expect(runtime.appearancePreferences.load()).resolves.toBe("light");

  await runtime.service.confirmAdult();
  expect(runtime.service.getSnapshot()).toMatchObject({ id: "journey-demo-1", ageConfirmed: true });

  const accountA = runtime.createJournalService("account-a");
  const accountB = runtime.createJournalService("account-b");
  await accountA.createRecord({
    title: "A 的手记",
    occurredAt: "2026-08-27T12:00:00.000Z",
    highlight: { kind: "feeling", text: "安心" },
  });
  await expect(accountA.listRecords()).resolves.toHaveLength(1);
  await expect(accountB.listRecords()).resolves.toEqual([]);
});

test("restores account-scoped Expo Go journals after rebuilding the runtime", async () => {
  const repository = new InMemoryJournalRepository();
  const fetchSpy = jest.spyOn(global, "fetch");
  let id = 0;
  let now = "2026-08-27T12:00:00.000Z";
  const createId = () => `journal-${++id}`;
  const clock = () => now;

  const first = await createExpoGoRuntime(repository, createId, clock);
  const accountA = first.createJournalService("account-a");
  const accountB = first.createJournalService("account-b");
  const recordA = await accountA.createRecord({
    title: "A 的手记",
    occurredAt: "2026-08-27",
    highlight: { kind: "feeling", text: "安心" },
    body: "初始内容",
  });
  await accountB.createRecord({
    title: "B 的手记",
    occurredAt: "2026-08-26",
    highlight: { kind: "impression", text: "清晰" },
  });
  const entry = await accountA.addEntry(recordA.id, {
    kind: "insight",
    occurredAt: "2026-08-27",
    body: "补充记录",
  });
  await accountA.savePeriodReview({
    periodStart: "2026-08-01T00:00:00.000Z",
    periodEnd: "2026-08-31T23:59:59.999Z",
    title: "八月回顾",
    body: "阶段回顾",
    sourceRecordIds: [recordA.id],
  });

  now = "2026-08-27T13:00:00.000Z";
  await accountA.updateRecord(recordA.id, { body: "更新后的内容" });
  await accountA.updateEntry(entry.id, { body: "更新后的补充" });

  const reopened = await createExpoGoRuntime(repository, createId, clock);
  const reopenedA = reopened.createJournalService("account-a");
  const reopenedB = reopened.createJournalService("account-b");
  await expect(reopenedA.loadRecord(recordA.id)).resolves.toMatchObject({
    record: { body: "更新后的内容" },
    entries: [{ body: "更新后的补充" }],
  });
  await expect(reopenedA.listPeriodReviews()).resolves.toMatchObject([
    { title: "八月回顾", body: "阶段回顾" },
  ]);
  await expect(reopenedB.listRecords()).resolves.toMatchObject([
    { title: "B 的手记" },
  ]);
  await expect(reopenedB.loadRecord(recordA.id)).resolves.toBeNull();

  await reopenedA.deleteEntry(entry.id);
  await reopenedA.deleteRecord(recordA.id);
  const afterDelete = await createExpoGoRuntime(repository, createId, clock);
  await expect(afterDelete.createJournalService("account-a").listRecords()).resolves.toEqual([]);
  await expect(afterDelete.createJournalService("account-b").listRecords()).resolves.toHaveLength(1);
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});

test("clears one Expo Go account or all local journals without mixing scopes", async () => {
  const repository = new InMemoryJournalRepository();
  let id = 0;
  const first = await createExpoGoRuntime(
    repository,
    () => `clear-${++id}`,
    () => "2026-08-27T12:00:00.000Z",
  );
  const accountA = first.createJournalService("account-a");
  const accountB = first.createJournalService("account-b");
  for (const [service, title] of [[accountA, "A"], [accountB, "B"]] as const) {
    await service.createRecord({
      title,
      occurredAt: "2026-08-27",
      highlight: { kind: "feeling", text: "安心" },
    });
  }

  await accountA.clearCurrentAccount();
  const reopened = await createExpoGoRuntime(
    repository,
    () => `clear-${++id}`,
    () => "2026-08-27T12:00:00.000Z",
  );
  await expect(reopened.createJournalService("account-a").listRecords()).resolves.toEqual([]);
  await expect(reopened.createJournalService("account-b").listRecords()).resolves.toHaveLength(1);

  await reopened.journal.clearAll();
  const afterClearAll = await createExpoGoRuntime(
    repository,
    () => `clear-${++id}`,
    () => "2026-08-27T12:00:00.000Z",
  );
  await expect(afterClearAll.createJournalService("account-a").listRecords()).resolves.toEqual([]);
  await expect(afterClearAll.createJournalService("account-b").listRecords()).resolves.toEqual([]);
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
    createExpoGoJournalRepository: createFreshExpoGoJournalRepository,
    createNativeRuntime
  })).rejects.toBe(failure);

  expect(createNativeRuntime).toHaveBeenCalledTimes(1);
});

test("deletes all Expo Go local data and restores device preferences", async () => {
  const deleteAdditionalStorage = jest.fn(async () => undefined);
  const runtime = await createJourneyRuntime({
    executionEnvironment: "storeClient",
    clipboard,
    createId: () => "delete-all-journey",
    now: () => "2026-08-27T12:00:00.000Z",
    createExpoGoJournalRepository: createFreshExpoGoJournalRepository,
    createNativeRuntime: jest.fn(),
    deleteAdditionalStorage,
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
  expect(deleteAdditionalStorage).toHaveBeenCalledTimes(1);
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
    createExpoGoJournalRepository: createFreshExpoGoJournalRepository,
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
    createExpoGoJournalRepository: createFreshExpoGoJournalRepository,
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

import { createJourneyDraft } from "../domain/types";
import type { JourneyCommand } from "../domain/commands";
import type { JourneyDraftRepository } from "../infrastructure/journey-draft-repository";
import { JourneyStorageError } from "../infrastructure/journey-draft-repository";
import { DefaultJourneyApplicationService } from "./journey-application-service";

function repository(initial = null as ReturnType<typeof createJourneyDraft> | null) {
  let stored = initial;
  const repo: JourneyDraftRepository = {
    loadActive: jest.fn(async () => stored),
    saveActive: jest.fn(async (draft) => { stored = draft; }),
    deleteActive: jest.fn(async () => { stored = null; })
  };
  return repo;
}

function service(repo = repository()) {
  return new DefaultJourneyApplicationService(repo, {
    createId: () => "journey-1",
    now: () => "2026-08-27T08:00:00.000Z"
  });
}

test("creates and persists a draft when the adult declaration is confirmed first", async () => {
  const repo = repository();
  const app = service(repo);

  await app.confirmAdult();

  expect(app.getSnapshot()).toMatchObject({
    id: "journey-1",
    ageConfirmed: true,
    prefaceRead: false,
    currentPage: "body-knowledge",
  });
  expect(repo.saveActive).toHaveBeenCalledTimes(1);
});

test("updates and persists an existing draft when the adult declaration is confirmed", async () => {
  const existing = {
    ...createJourneyDraft({ id: "journey-existing", now: "earlier" }),
    addressPreference: "妳" as const,
    prefaceRead: true,
    currentPage: "overnight" as const,
  };
  const repo = repository(existing);
  const app = service(repo);
  await app.initialize();

  await app.confirmAdult();

  expect(app.getSnapshot()).toMatchObject({
    id: "journey-existing",
    addressPreference: "妳",
    ageConfirmed: true,
    prefaceRead: false,
    currentPage: "body-knowledge",
    updatedAt: "2026-08-27T08:00:00.000Z",
  });
  expect(repo.saveActive).toHaveBeenCalledTimes(1);
});

test("keeps an already confirmed adult declaration idempotent", async () => {
  const existing = {
    ...createJourneyDraft({ id: "journey-confirmed", now: "earlier" }),
    ageConfirmed: true,
    prefaceRead: true,
    currentPage: "reflection" as const,
  };
  const repo = repository(existing);
  const app = service(repo);
  await app.initialize();

  await app.confirmAdult();

  expect(app.getSnapshot()).toBe(existing);
  expect(repo.saveActive).not.toHaveBeenCalled();
});

test("does not expose a pre-declaration journey creation API", () => {
  expect(service()).not.toHaveProperty("beginJourney");
});

test("rejects preface and knowledge commands until the draft has an adult declaration", async () => {
  const repo = repository(createJourneyDraft({ id: "undeclared", now: "earlier" }));
  const app = service(repo);
  await app.initialize();
  const blockedCommands: JourneyCommand[] = [
    { type: "set-preface-read", read: true },
    { type: "set-address-preference", preference: "你" },
    { type: "mark-knowledge-card-read", cardId: "draft-knowledge-consent" },
    { type: "set-medical-diagram-opened", opened: true },
    { type: "record-point-event", key: "learning:body-signals:v1" },
  ];

  for (const command of blockedCommands) {
    await expect(app.dispatch(command)).rejects.toThrow("journey-not-active");
  }
  expect(repo.saveActive).not.toHaveBeenCalled();
});

test("dispatches reducer then builders and performs one atomic save", async () => {
  const repo = repository();
  const app = service(repo);
  await app.confirmAdult();
  jest.mocked(repo.saveActive).mockClear();

  await app.dispatch({
    type: "save-overnight-progress",
    completed: false,
    stage: "expectations",
    expectationIds: ["draft-rest"],
    concernIds: [],
    customNote: "",
  });

  expect(repo.saveActive).toHaveBeenCalledTimes(1);
  expect(app.getSnapshot()).toMatchObject({
    expectationIds: ["draft-rest"],
    privatePreparation: {
      items: [expect.objectContaining({ id: "checklist:logistics" })]
    },
    communicationCard: expect.objectContaining({
      "communication-night-expectations": expect.any(Object)
    })
  });
});

test("does not advance the in-memory snapshot when persistence fails", async () => {
  const repo = repository();
  const app = service(repo);
  await app.confirmAdult();
  const before = app.getSnapshot();
  jest.mocked(repo.saveActive).mockRejectedValueOnce(new Error("disk full"));

  await expect(app.dispatch({
    type: "save-overnight-progress",
    completed: false,
    stage: "concerns",
    expectationIds: [],
    concernIds: ["draft-pressure"],
    customNote: "",
  }))
    .rejects.toThrow("disk full");
  expect(app.getSnapshot()).toBe(before);
});

test("serializes concurrent commands so later updates cannot overwrite earlier ones", async () => {
  const repo = repository();
  const app = service(repo);
  await app.confirmAdult();
  const first = app.dispatch({
    type: "save-overnight-progress",
    completed: false,
    stage: "expectations",
    expectationIds: ["draft-rest"],
    concernIds: [],
    customNote: "",
  });
  const second = app.dispatch({
    type: "save-overnight-progress",
    completed: false,
    stage: "concerns",
    expectationIds: ["draft-rest"],
    concernIds: ["draft-pressure"],
    customNote: "",
  });

  await Promise.all([first, second]);

  expect(app.getSnapshot()).toMatchObject({
    expectationIds: ["draft-rest"],
    concernIds: ["draft-pressure"]
  });
});

test("restores a supported active draft and reports unsupported storage for explicit recovery", async () => {
  const saved = {
    ...createJourneyDraft({ id: "journey-1", now: "now" }),
    ageConfirmed: true,
    currentPage: "reflection" as const
  };
  const restored = service(repository(saved));
  await expect(restored.initialize()).resolves.toBe("ready");
  expect(restored.getSnapshot()?.currentPage).toBe("reflection");

  const badRepo = repository();
  jest.mocked(badRepo.loadActive).mockRejectedValueOnce(new JourneyStorageError("unsupported-schema"));
  await expect(service(badRepo).initialize()).resolves.toBe("recovery-required");
});

test("reset removes only the active journey and clears the snapshot", async () => {
  const repo = repository();
  const app = service(repo);
  await app.confirmAdult();

  await app.resetJourney();

  expect(repo.deleteActive).toHaveBeenCalledTimes(1);
  expect(app.getSnapshot()).toBeNull();
});

test("persists page navigation only after adult confirmation", async () => {
  const app = service();
  await expect(app.navigateTo("overnight")).rejects.toThrow("journey-not-active");
  await app.confirmAdult();

  await app.navigateTo("overnight");

  expect(app.getSnapshot()?.currentPage).toBe("overnight");
});

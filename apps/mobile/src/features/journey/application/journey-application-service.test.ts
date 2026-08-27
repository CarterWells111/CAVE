import { createJourneyDraft } from "../domain/types";
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

test("confirms an adult by creating and saving the first active draft", async () => {
  const repo = repository();
  const app = service(repo);

  await app.confirmAdult();

  expect(app.getSnapshot()).toMatchObject({ id: "journey-1", ageConfirmed: true, schemaVersion: 1 });
  expect(repo.saveActive).toHaveBeenCalledTimes(1);
});

test("dispatches reducer then builders and performs one atomic save", async () => {
  const repo = repository();
  const app = service(repo);
  await app.confirmAdult();
  jest.mocked(repo.saveActive).mockClear();

  await app.dispatch({ type: "set-expectation-ids", ids: ["draft-rest"] });

  expect(repo.saveActive).toHaveBeenCalledTimes(1);
  expect(app.getSnapshot()).toMatchObject({
    expectationIds: ["draft-rest"],
    checklistItems: [expect.objectContaining({ id: "checklist:logistics" })],
    communicationCard: expect.objectContaining({ intentions: expect.any(Object) })
  });
});

test("does not advance the in-memory snapshot when persistence fails", async () => {
  const repo = repository();
  const app = service(repo);
  await app.confirmAdult();
  const before = app.getSnapshot();
  jest.mocked(repo.saveActive).mockRejectedValueOnce(new Error("disk full"));

  await expect(app.dispatch({ type: "set-concern-ids", ids: ["draft-pressure"] }))
    .rejects.toThrow("disk full");
  expect(app.getSnapshot()).toBe(before);
});

test("serializes concurrent commands so later updates cannot overwrite earlier ones", async () => {
  const repo = repository();
  const app = service(repo);
  await app.confirmAdult();
  const first = app.dispatch({ type: "set-expectation-ids", ids: ["draft-rest"] });
  const second = app.dispatch({ type: "set-concern-ids", ids: ["draft-pressure"] });

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

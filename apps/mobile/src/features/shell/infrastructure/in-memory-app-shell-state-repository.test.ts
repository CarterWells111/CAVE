import { InMemoryAppShellStateRepository } from "./in-memory-app-shell-state-repository";

const firstCompletion = {
  initialJourneyId: "journey-first",
  initialJourneyCompletedAt: "2026-08-27T12:00:00.000Z"
};

test("loads null before the first journey is completed", async () => {
  const repository = new InMemoryAppShellStateRepository();

  await expect(repository.load()).resolves.toBeNull();
});

test("stores only the first completion marker and returns defensive copies", async () => {
  const repository = new InMemoryAppShellStateRepository();

  await expect(repository.completeInitialJourney(firstCompletion)).resolves.toEqual(firstCompletion);
  await expect(repository.completeInitialJourney({
    initialJourneyId: "journey-later",
    initialJourneyCompletedAt: "2026-08-28T12:00:00.000Z"
  })).resolves.toEqual(firstCompletion);

  const loaded = await repository.load();
  expect(loaded).toEqual(firstCompletion);
  expect(loaded).not.toBe(firstCompletion);
});

test("clears the completion marker", async () => {
  const repository = new InMemoryAppShellStateRepository(firstCompletion);

  await repository.clear();

  await expect(repository.load()).resolves.toBeNull();
});

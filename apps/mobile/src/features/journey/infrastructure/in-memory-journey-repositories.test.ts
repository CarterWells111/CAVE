import { createJourneyDraft, type SavedCommunicationCardRecord } from "../domain/types";
import {
  InMemoryCommunicationCardRepository,
  InMemoryJourneyDraftRepository
} from "./in-memory-journey-repositories";

test("keeps journey drafts only in the repository instance and clones both writes and reads", async () => {
  const repository = new InMemoryJourneyDraftRepository();
  const draft = {
    ...createJourneyDraft({ id: "journey-1", now: "2026-08-27T12:00:00.000Z" }),
    ageConfirmed: true
  };

  await repository.saveActive(draft);
  draft.expectationIds.push("mutated-after-save");
  const firstRead = await repository.loadActive();
  firstRead?.concernIds.push("mutated-after-read");

  expect(await repository.loadActive()).toMatchObject({
    id: "journey-1",
    expectationIds: [],
    concernIds: []
  });

  await repository.deleteActive();
  expect(await repository.loadActive()).toBeNull();
  expect(await new InMemoryJourneyDraftRepository().loadActive()).toBeNull();
});

test("upserts, clones and deletes communication cards inside one repository instance", async () => {
  const repository = new InMemoryCommunicationCardRepository();
  const record: SavedCommunicationCardRecord = {
    id: "card:journey-1",
    journeyId: "journey-1",
    card: createJourneyDraft({ id: "card-draft", now: "2026-08-27T12:00:00.000Z" }).communicationCard,
    savedAt: "2026-08-27T12:00:00.000Z"
  };

  await repository.save(record);
  record.savedAt = "mutated-after-save";
  const firstRead = await repository.list();
  firstRead[0]!.savedAt = "mutated-after-read";
  await repository.save({ ...record, savedAt: "2026-08-27T12:05:00.000Z" });

  expect(await repository.list()).toEqual([
    expect.objectContaining({ id: "card:journey-1", savedAt: "2026-08-27T12:05:00.000Z" })
  ]);

  await repository.delete("card:journey-1");
  expect(await repository.list()).toEqual([]);
});

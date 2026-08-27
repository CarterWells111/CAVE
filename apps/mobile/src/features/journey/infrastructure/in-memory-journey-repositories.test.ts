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

test("projects sorted communication-card metadata without exposing card payloads", async () => {
  const repository = new InMemoryCommunicationCardRepository();
  const privateCard = createJourneyDraft({ id: "private-card", now: "now" }).communicationCard;
  privateCard["communication-comfort"].userText = "sensitive private text";

  await repository.save({
    id: "card-older",
    journeyId: "journey-older",
    card: privateCard,
    savedAt: "2026-08-27T12:00:00.000Z",
  });
  await repository.save({
    id: "card-newer",
    journeyId: "journey-newer",
    card: privateCard,
    savedAt: "2026-08-27T13:00:00.000Z",
  });

  const metadata = await repository.listMetadata();

  expect(metadata).toEqual([
    { id: "card-newer", journeyId: "journey-newer", savedAt: "2026-08-27T13:00:00.000Z" },
    { id: "card-older", journeyId: "journey-older", savedAt: "2026-08-27T12:00:00.000Z" },
  ]);
  expect(JSON.stringify(metadata)).not.toMatch(/payload|communication-comfort|sensitive private text/u);
  await expect(repository.load("card-newer")).resolves.toMatchObject({ id: "card-newer" });
  await expect(repository.load("missing")).resolves.toBeNull();
});

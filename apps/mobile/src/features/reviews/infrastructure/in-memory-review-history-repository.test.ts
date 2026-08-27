import { createJourneyDraft } from "../../journey/domain/types";
import { createReviewVersion, type ActiveReview, type ReviewVersion } from "../domain/versioned-review";
import { InMemoryReviewHistoryRepository } from "./in-memory-review-history-repository";

function active(id: string, note = "private"): ActiveReview {
  const draft = createJourneyDraft({ id, now: "2026-08-27T12:00:00.000Z" });
  draft.journal.text = note;
  return { parentVersionId: null, title: "八月回顾", draft };
}

function version(id: string, createdAt: string, parentVersionId: string | null = null): ReviewVersion {
  const review = active(`review-${id}`, `secret ${id}`);
  return createReviewVersion({ id, parentVersionId, title: `回顾 ${id}`, status: "completed", draft: review.draft, createdAt });
}

test("keeps exactly one cloned active draft and clears it only after successful completion", async () => {
  const repository = new InMemoryReviewHistoryRepository();
  const first = active("active-1", "first");
  const second = active("active-2", "second");

  await repository.saveActive(first);
  await repository.saveActive(second);
  second.draft.journal.text = "mutated outside";

  const loaded = await repository.loadActive();
  expect(loaded?.draft.journal.text).toBe("second");
  if (loaded) loaded.draft.journal.text = "mutated result";
  expect((await repository.loadActive())?.draft.journal.text).toBe("second");

  await repository.completeActive(version("completed", "2026-08-27T13:00:00.000Z"));
  expect(await repository.loadActive()).toBeNull();
});

test("appends immutable versions and lists neutral metadata without payload", async () => {
  const repository = new InMemoryReviewHistoryRepository();
  const older = version("version-1", "2026-08-20T12:00:00.000Z");
  const newer = version("version-2", "2026-08-27T12:00:00.000Z", "version-1");

  await repository.saveVersion(older);
  await repository.saveVersion(newer);
  newer.payload.journal.text = "mutated outside";

  await expect(repository.saveVersion(version("version-2", "2026-08-28T12:00:00.000Z"))).rejects.toThrow(
    "Review version already exists"
  );
  const metadata = await repository.listMetadata();
  expect(metadata.map(({ id }) => id)).toEqual(["version-2", "version-1"]);
  expect(metadata.every((item) => !("payload" in item))).toBe(true);

  const detail = await repository.loadVersion("version-2");
  expect(detail?.payload.journal.text).toBe("secret version-2");
  if (detail) detail.payload.journal.text = "mutated result";
  expect((await repository.loadVersion("version-2"))?.payload.journal.text).toBe("secret version-2");
});

test("provides a cloned branch seed without changing history or the active draft", async () => {
  const repository = new InMemoryReviewHistoryRepository();
  await repository.saveVersion(version("version-1", "2026-08-20T12:00:00.000Z"));
  await repository.saveActive(active("existing-active"));

  const seed = await repository.loadBranchSeed("version-1");
  expect(seed).toMatchObject({ id: "version-1", title: "回顾 version-1", payload: { journal: { text: "secret version-1" } } });
  if (seed) seed.payload.journal.text = "mutated branch";
  expect((await repository.loadVersion("version-1"))?.payload.journal.text).toBe("secret version-1");
  expect((await repository.loadActive())?.draft.id).toBe("existing-active");
  expect(await repository.loadBranchSeed("missing")).toBeNull();
});

test("rolls back atomic active replacement when its immutable version already exists", async () => {
  const repository = new InMemoryReviewHistoryRepository();
  const duplicate = version("duplicate", "2026-08-20T12:00:00.000Z");
  await repository.saveVersion(duplicate);
  await repository.saveActive(active("existing-active"));

  await expect(repository.archiveAndReplace(duplicate, active("replacement"))).rejects.toThrow(
    "Review version already exists"
  );
  expect((await repository.loadActive())?.draft.id).toBe("existing-active");
  expect((await repository.listMetadata()).map(({ id }) => id)).toEqual(["duplicate"]);
});

test("deletes one version atomically, detaches children, and leaves state unchanged for a missing id", async () => {
  const repository = new InMemoryReviewHistoryRepository();
  await repository.saveVersion(version("version-1", "2026-08-20T12:00:00.000Z"));
  await repository.saveVersion(version("version-2", "2026-08-27T12:00:00.000Z", "version-1"));

  expect(await repository.deleteVersion("missing")).toBe(false);
  expect((await repository.listMetadata()).map(({ id }) => id)).toEqual(["version-2", "version-1"]);

  expect(await repository.deleteVersion("version-1")).toBe(true);
  expect(await repository.loadVersion("version-1")).toBeNull();
  expect((await repository.loadVersion("version-2"))?.parentVersionId).toBeNull();
});

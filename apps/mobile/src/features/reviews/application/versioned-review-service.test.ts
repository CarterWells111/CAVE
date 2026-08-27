import { createJourneyDraft, type JourneyDraft } from "../../journey/domain/types";
import type {
  ActiveReview,
  ReviewVersion,
  ReviewVersionMetadata,
} from "../domain/versioned-review";
import {
  VersionedReviewService,
  type VersionedReviewRepository,
} from "./versioned-review-service";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

class MemoryRepository implements VersionedReviewRepository {
  active: ActiveReview | null = null;
  versions = new Map<string, ReviewVersion>();

  async loadActive() { return this.active === null ? null : clone(this.active); }
  async saveActive(active: ActiveReview) { this.active = clone(active); }
  async saveVersion(version: ReviewVersion) {
    if (!this.versions.has(version.id)) this.versions.set(version.id, clone(version));
  }
  async archiveAndReplace(version: ReviewVersion, active: ActiveReview) {
    await this.saveVersion(version);
    this.active = clone(active);
  }
  async completeActive(version: ReviewVersion) {
    await this.saveVersion(version);
    this.active = null;
  }
  async loadVersion(id: string) { return clone(this.versions.get(id) ?? null); }
  async listMetadata(): Promise<ReviewVersionMetadata[]> { return []; }
}

function draft(id: string): JourneyDraft {
  return { ...createJourneyDraft({ id, now: "2026-08-27T10:00:00.000Z" }), ageConfirmed: true };
}

function service(repository = new MemoryRepository()) {
  let sequence = 0;
  return {
    repository,
    service: new VersionedReviewService(repository, {
      createVersionId: () => `version-${++sequence}`,
      now: () => `2026-08-27T1${sequence}:00:00.000Z`,
    }),
  };
}

test("keeps one active review and requires an explicit replacement decision", async () => {
  const { repository, service: reviews } = service();

  await expect(reviews.start({ draft: draft("review-1"), title: "第一次" }))
    .resolves.toMatchObject({ status: "started", active: { title: "第一次" } });
  await expect(reviews.start({ draft: draft("review-2"), title: "第二次" }))
    .resolves.toMatchObject({ status: "resume-existing", active: { draft: { id: "review-1" } } });
  expect(repository.active?.draft.id).toBe("review-1");
});

test("replacement preserves the previous active review as an immutable incomplete version first", async () => {
  const { repository, service: reviews } = service();
  await reviews.start({ draft: draft("review-1"), title: "第一次" });

  await reviews.replace({ draft: draft("review-2"), title: "第二次" });

  expect([...repository.versions.values()]).toHaveLength(1);
  expect([...repository.versions.values()][0]).toMatchObject({
    status: "incomplete",
    title: "第一次",
    payload: { id: "review-1" },
  });
  expect(repository.active).toMatchObject({ title: "第二次", draft: { id: "review-2" } });
});

test("checkpoints and completion create immutable versions while only completion clears active", async () => {
  const { repository, service: reviews } = service();
  await reviews.start({ draft: draft("review-1"), title: "本次回顾" });

  const checkpoint = await reviews.checkpoint();
  expect(checkpoint.status).toBe("incomplete");
  expect(repository.active?.draft.id).toBe("review-1");

  const completed = await reviews.complete();
  expect(completed.status).toBe("completed");
  expect(completed.id).not.toBe(checkpoint.id);
  expect(repository.active).toBeNull();
  expect(repository.versions.size).toBe(2);
});

test("branches from a selected historical version without changing its payload", async () => {
  const { repository, service: reviews } = service();
  await reviews.start({ draft: draft("source-review"), title: "源版本" });
  const historical = await reviews.complete();
  const before = JSON.stringify(await repository.loadVersion(historical.id));

  const branched = await reviews.branch(historical.id, {
    reviewId: "branched-review",
    title: "分支回顾",
  });

  expect(branched).toMatchObject({
    parentVersionId: historical.id,
    title: "分支回顾",
    draft: { id: "branched-review" },
  });
  expect(JSON.stringify(await repository.loadVersion(historical.id))).toBe(before);
});

test("autosaves only active state and participation events are idempotent", async () => {
  const { repository, service: reviews } = service();
  await reviews.start({ draft: draft("review-1"), title: "本次回顾" });
  const historicalCount = repository.versions.size;

  await reviews.update((current) => ({ ...current, overnightCustomNote: "private value" }));
  await reviews.recordParticipation("practice:preset:first-completion");
  await reviews.recordParticipation("practice:preset:first-completion");

  expect(repository.versions.size).toBe(historicalCount);
  expect(repository.active?.draft).toMatchObject({
    overnightCustomNote: "private value",
    pointEventKeys: ["practice:preset:first-completion"],
  });
});

import { buildCommunicationCard } from "../../journey/domain/derive-communication-card";
import { createJourneyDraft, type JourneyDraft } from "../../journey/domain/types";
import {
  branchReviewVersion,
  createReviewVersion,
  projectReviewVersionMetadata,
  recomputeReviewDerivedState,
  recordReviewParticipation,
} from "./versioned-review";

function draft(id = "review-1"): JourneyDraft {
  const base = {
    ...createJourneyDraft({ id, now: "2026-08-27T10:00:00.000Z" }),
    ageConfirmed: true,
    expectationIds: ["draft-expect-rest"],
  };
  return { ...base, communicationCard: buildCommunicationCard(base) };
}

test("creates an immutable completed or incomplete snapshot and projects neutral metadata", () => {
  const source = draft();
  source.journal.text = "private journal value";
  const version = createReviewVersion({
    id: "version-1",
    parentVersionId: null,
    title: "八月回顾",
    status: "completed",
    draft: source,
    createdAt: "2026-08-27T11:00:00.000Z",
  });

  source.journal.text = "mutated later";
  expect(version.payload.journal.text).toBe("private journal value");
  expect(version.sourceRevision).toBe(version.payload.sourceRevision);
  expect(projectReviewVersionMetadata(version)).toEqual({
    id: "version-1",
    parentVersionId: null,
    title: "八月回顾",
    status: "completed",
    createdAt: "2026-08-27T11:00:00.000Z",
    sourceRevision: version.sourceRevision,
  });
  expect(JSON.stringify(projectReviewVersionMetadata(version))).not.toContain("private journal value");
});

test("deterministically recomputes derived fields while preserving edits for review", () => {
  const original = draft();
  const section = "communication-night-expectations" as const;
  original.communicationCard[section] = {
    ...original.communicationCard[section],
    userText: "my own wording",
    needsReview: false,
    visibility: "included",
  };
  const changed = {
    ...original,
    expectationIds: ["draft-expect-talk"],
    sourceRevision: original.sourceRevision + 1,
  };

  const first = recomputeReviewDerivedState(changed);
  const second = recomputeReviewDerivedState(changed);

  expect(first).toEqual(second);
  expect(first.communicationCard[section]).toMatchObject({
    userText: "my own wording",
    needsReview: true,
    visibility: "included",
  });
  expect(first.privatePreparation.items).toEqual(second.privatePreparation.items);
});

test("branches without mutating history and carries participation keys without awarding from content", () => {
  const source = createReviewVersion({
    id: "version-source",
    parentVersionId: null,
    title: "旧回顾",
    status: "completed",
    draft: recordReviewParticipation(draft("old-review"), "reflection:page-5:v1"),
    createdAt: "2026-08-27T11:00:00.000Z",
  });
  const before = JSON.stringify(source);

  const active = branchReviewVersion(source, {
    reviewId: "new-review",
    title: "从旧回顾继续",
    now: "2026-08-28T09:00:00.000Z",
  });

  expect(JSON.stringify(source)).toBe(before);
  expect(active).toMatchObject({ parentVersionId: "version-source", title: "从旧回顾继续" });
  expect(active.draft).toMatchObject({
    id: "new-review",
    createdAt: "2026-08-28T09:00:00.000Z",
    updatedAt: "2026-08-28T09:00:00.000Z",
    pointEventKeys: ["reflection:page-5:v1"],
  });
  expect(recordReviewParticipation(active.draft, "reflection:page-5:v1").pointEventKeys)
    .toEqual(["reflection:page-5:v1"]);
  expect(recordReviewParticipation(active.draft, "review:checklist:v1").pointEventKeys)
    .toEqual(["reflection:page-5:v1", "review:checklist:v1"]);
});

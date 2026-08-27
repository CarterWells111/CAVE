import { buildCommunicationCard } from "../../journey/domain/derive-communication-card";
import { buildPrivatePreparation } from "../../journey/domain/derive-checklist";
import type { JourneyDraft } from "../../journey/domain/types";

export type ReviewVersionStatus = "completed" | "incomplete";

export type ReviewVersion = Readonly<{
  id: string;
  parentVersionId: string | null;
  title: string;
  status: ReviewVersionStatus;
  payload: JourneyDraft;
  createdAt: string;
  sourceRevision: number;
}>;

export type ReviewVersionMetadata = Readonly<{
  id: string;
  parentVersionId: string | null;
  title: string;
  status: ReviewVersionStatus;
  createdAt: string;
  sourceRevision: number;
}>;

export type ActiveReview = Readonly<{
  parentVersionId: string | null;
  title: string;
  draft: JourneyDraft;
}>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createReviewVersion(input: {
  id: string;
  parentVersionId: string | null;
  title: string;
  status: ReviewVersionStatus;
  draft: JourneyDraft;
  createdAt: string;
}): ReviewVersion {
  const payload = clone(input.draft);
  return {
    id: input.id,
    parentVersionId: input.parentVersionId,
    title: input.title,
    status: input.status,
    payload,
    createdAt: input.createdAt,
    sourceRevision: payload.sourceRevision,
  };
}

export function projectReviewVersionMetadata(version: ReviewVersion): ReviewVersionMetadata {
  const { id, parentVersionId, title, status, createdAt, sourceRevision } = version;
  return { id, parentVersionId, title, status, createdAt, sourceRevision };
}

export function recomputeReviewDerivedState(draft: JourneyDraft): JourneyDraft {
  const withPreparation = { ...draft, privatePreparation: buildPrivatePreparation(draft) };
  return { ...withPreparation, communicationCard: buildCommunicationCard(withPreparation) };
}

export function branchReviewVersion(
  version: ReviewVersion,
  input: { reviewId: string; title: string; now: string },
): ActiveReview {
  const draft = clone(version.payload);
  return {
    parentVersionId: version.id,
    title: input.title,
    draft: {
      ...draft,
      id: input.reviewId,
      createdAt: input.now,
      updatedAt: input.now,
    },
  };
}

export function recordReviewParticipation(draft: JourneyDraft, eventKey: string): JourneyDraft {
  if (draft.pointEventKeys.includes(eventKey)) return clone(draft);
  return { ...clone(draft), pointEventKeys: [...draft.pointEventKeys, eventKey] };
}

import type { VersionedReviewRepository } from "../application/versioned-review-service";
import type { ReviewVersion as DomainReviewVersion } from "../domain/versioned-review";

export type ActiveReview<Payload> = Readonly<{
  id: string;
  rootId: string;
  sourceVersionId: string | null;
  title: string;
  updatedAt: string;
  payload: Payload;
}>;

export type ReviewVersionMetadata = Readonly<{
  id: string;
  rootId: string;
  parentVersionId: string | null;
  title: string;
  createdAt: string;
  status: "incomplete" | "completed";
}>;

export type ReviewVersionInput<Payload> = ReviewVersionMetadata & Readonly<{ payload: Payload }>;
export type ReviewVersionDetail<Payload> = ReviewVersionInput<Payload>;

export type ReviewBranchSeed<Payload> = Readonly<{
  rootId: string;
  sourceVersionId: string;
  suggestedTitle: string;
  payload: Payload;
}>;

export interface ReviewHistoryRepository<Payload> {
  loadActive(): Promise<ActiveReview<Payload> | null>;
  saveActive(review: ActiveReview<Payload>): Promise<void>;
  clearActive(): Promise<void>;
  appendVersion(version: ReviewVersionInput<Payload>): Promise<void>;
  appendVersionAndClearActive(version: ReviewVersionInput<Payload>): Promise<void>;
  listMetadata(): Promise<ReadonlyArray<ReviewVersionMetadata>>;
  loadDetail(id: string): Promise<ReviewVersionDetail<Payload> | null>;
  loadBranchSeed(id: string): Promise<ReviewBranchSeed<Payload> | null>;
  deleteVersion(id: string): Promise<boolean>;
  clearAll(): Promise<void>;
}

export interface VersionedReviewHistoryRepository extends VersionedReviewRepository {
  loadBranchSeed(id: string): Promise<DomainReviewVersion | null>;
  deleteVersion(id: string): Promise<boolean>;
  clearAll(): Promise<void>;
}

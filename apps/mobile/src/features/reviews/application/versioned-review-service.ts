import type { JourneyDraft } from "../../journey/domain/types";
import {
  branchReviewVersion,
  createReviewVersion,
  recomputeReviewDerivedState,
  recordReviewParticipation,
  type ActiveReview,
  type ReviewVersion,
  type ReviewVersionMetadata,
  type ReviewVersionStatus,
} from "../domain/versioned-review";

export interface VersionedReviewRepository {
  loadActive(): Promise<ActiveReview | null>;
  saveActive(active: ActiveReview): Promise<void>;
  saveVersion(version: ReviewVersion): Promise<void>;
  archiveAndReplace(previous: ReviewVersion, next: ActiveReview): Promise<void>;
  completeActive(version: ReviewVersion): Promise<void>;
  loadVersion(id: string): Promise<ReviewVersion | null>;
  listMetadata(): Promise<ReviewVersionMetadata[]>;
}

export class VersionedReviewServiceError extends Error {
  constructor(readonly code: "active-review-required" | "active-review-exists" | "review-version-not-found") {
    super(code);
    this.name = "VersionedReviewServiceError";
  }
}

type Dependencies = Readonly<{
  createVersionId(): string;
  now(): string;
}>;

export type StartReviewResult =
  | Readonly<{ status: "started"; active: ActiveReview }>
  | Readonly<{ status: "resume-existing"; active: ActiveReview }>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class VersionedReviewService {
  constructor(
    private readonly repository: VersionedReviewRepository,
    private readonly dependencies: Dependencies,
  ) {}

  async start(input: { draft: JourneyDraft; title: string }): Promise<StartReviewResult> {
    const existing = await this.repository.loadActive();
    if (existing !== null) return { status: "resume-existing", active: clone(existing) };
    const active = this.activeFrom(input.draft, input.title, null);
    await this.repository.saveActive(active);
    return { status: "started", active: clone(active) };
  }

  async replace(input: { draft: JourneyDraft; title: string }): Promise<ActiveReview> {
    const existing = this.requireActive(await this.repository.loadActive());
    const archived = this.versionFrom(existing, "incomplete");
    const next = this.activeFrom(input.draft, input.title, null);
    await this.repository.archiveAndReplace(archived, next);
    return clone(next);
  }

  async checkpoint(): Promise<ReviewVersion> {
    const active = this.requireActive(await this.repository.loadActive());
    const version = this.versionFrom(active, "incomplete");
    await this.repository.saveVersion(version);
    return clone(version);
  }

  async complete(): Promise<ReviewVersion> {
    const active = this.requireActive(await this.repository.loadActive());
    const version = this.versionFrom(active, "completed");
    await this.repository.completeActive(version);
    return clone(version);
  }

  async branch(versionId: string, input: { reviewId: string; title: string }): Promise<ActiveReview> {
    if (await this.repository.loadActive() !== null) {
      throw new VersionedReviewServiceError("active-review-exists");
    }
    const version = await this.repository.loadVersion(versionId);
    if (version === null) throw new VersionedReviewServiceError("review-version-not-found");
    const active = branchReviewVersion(version, { ...input, now: this.dependencies.now() });
    await this.repository.saveActive(active);
    return clone(active);
  }

  async update(transform: (draft: JourneyDraft) => JourneyDraft): Promise<ActiveReview> {
    const active = this.requireActive(await this.repository.loadActive());
    const draft = recomputeReviewDerivedState(transform(clone(active.draft)));
    const next = { ...active, draft };
    await this.repository.saveActive(next);
    return clone(next);
  }

  recordParticipation(eventKey: string): Promise<ActiveReview> {
    return this.update((draft) => recordReviewParticipation(draft, eventKey));
  }

  listMetadata(): Promise<ReviewVersionMetadata[]> {
    return this.repository.listMetadata();
  }

  loadVersion(id: string): Promise<ReviewVersion | null> {
    return this.repository.loadVersion(id);
  }

  private activeFrom(draft: JourneyDraft, title: string, parentVersionId: string | null): ActiveReview {
    return { parentVersionId, title, draft: recomputeReviewDerivedState(clone(draft)) };
  }

  private versionFrom(active: ActiveReview, status: ReviewVersionStatus): ReviewVersion {
    return createReviewVersion({
      id: this.dependencies.createVersionId(),
      parentVersionId: active.parentVersionId,
      title: active.title,
      status,
      draft: active.draft,
      createdAt: this.dependencies.now(),
    });
  }

  private requireActive(active: ActiveReview | null): ActiveReview {
    if (active === null) throw new VersionedReviewServiceError("active-review-required");
    return active;
  }
}

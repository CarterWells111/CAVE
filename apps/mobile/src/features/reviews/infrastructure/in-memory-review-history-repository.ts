import { projectReviewVersionMetadata, type ActiveReview, type ReviewVersion } from "../domain/versioned-review";
import type { VersionedReviewHistoryRepository } from "./review-history-repository";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class InMemoryReviewHistoryRepository implements VersionedReviewHistoryRepository {
  private active: ActiveReview | null = null;
  private versions = new Map<string, ReviewVersion>();

  async loadActive(): Promise<ActiveReview | null> {
    return this.active === null ? null : clone(this.active);
  }

  async saveActive(active: ActiveReview): Promise<void> {
    this.active = clone(active);
  }

  async saveVersion(version: ReviewVersion): Promise<void> {
    this.versions = this.withVersion(version);
  }

  async archiveAndReplace(previous: ReviewVersion, next: ActiveReview): Promise<void> {
    const nextVersions = this.withVersion(previous);
    const nextActive = clone(next);
    this.versions = nextVersions;
    this.active = nextActive;
  }

  async completeActive(version: ReviewVersion): Promise<void> {
    const nextVersions = this.withVersion(version);
    this.versions = nextVersions;
    this.active = null;
  }

  async loadVersion(id: string): Promise<ReviewVersion | null> {
    const version = this.versions.get(id);
    return version === undefined ? null : clone(version);
  }

  async listMetadata() {
    return [...this.versions.values()]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))
      .map(projectReviewVersionMetadata);
  }

  loadBranchSeed(id: string): Promise<ReviewVersion | null> {
    return this.loadVersion(id);
  }

  async deleteVersion(id: string): Promise<boolean> {
    if (!this.versions.has(id)) return false;
    const next = new Map<string, ReviewVersion>();
    for (const [versionId, version] of this.versions) {
      if (versionId === id) continue;
      next.set(versionId, version.parentVersionId === id ? { ...version, parentVersionId: null } : version);
    }
    this.versions = next;
    return true;
  }

  async clearAll(): Promise<void> {
    this.active = null;
    this.versions = new Map();
  }

  private withVersion(version: ReviewVersion): Map<string, ReviewVersion> {
    if (this.versions.has(version.id)) throw new Error("Review version already exists");
    const next = new Map(this.versions);
    next.set(version.id, clone(version));
    return next;
  }
}

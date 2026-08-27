import type { ActiveReview, ReviewBranchSeed, ReviewHistoryRepository, ReviewVersionDetail, ReviewVersionInput } from "./review-history-repository";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class InMemoryPayloadReviewHistoryRepository<Payload> implements ReviewHistoryRepository<Payload> {
  private active: ActiveReview<Payload> | null = null;
  private versions = new Map<string, ReviewVersionDetail<Payload>>();
  async loadActive() { return this.active === null ? null : clone(this.active); }
  async saveActive(active: ActiveReview<Payload>) { this.active = clone(active); }
  async clearActive() { this.active = null; }
  async appendVersion(version: ReviewVersionInput<Payload>) {
    if (!this.versions.has(version.id)) this.versions.set(version.id, clone(version));
  }
  async listMetadata() {
    return [...this.versions.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((value) => ({
      id: value.id, rootId: value.rootId, parentVersionId: value.parentVersionId,
      title: value.title, createdAt: value.createdAt, status: value.status,
    }));
  }
  async loadDetail(id: string) { const value = this.versions.get(id); return value === undefined ? null : clone(value); }
  async loadBranchSeed(id: string): Promise<ReviewBranchSeed<Payload> | null> {
    const value = await this.loadDetail(id);
    return value === null ? null : { rootId: value.rootId, sourceVersionId: value.id, suggestedTitle: value.title, payload: value.payload };
  }
  async deleteVersion(id: string) {
    if (!this.versions.has(id)) return false;
    this.versions.delete(id);
    for (const [key, value] of this.versions) if (value.parentVersionId === id) this.versions.set(key, { ...value, parentVersionId: null });
    if (this.active?.sourceVersionId === id) this.active = { ...this.active, sourceVersionId: null };
    return true;
  }
  async clearAll() { this.active = null; this.versions.clear(); }
}

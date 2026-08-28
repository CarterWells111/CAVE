import type { JourneyDraft } from "../../journey/domain/types";
import type { JourneyDraftRepository } from "../../journey/infrastructure/journey-draft-repository";
import type { ReviewHistoryRepository } from "./review-history-repository";

export class VersionedJourneyDraftRepository implements JourneyDraftRepository {
  constructor(
    private readonly drafts: JourneyDraftRepository,
    private readonly reviews: ReviewHistoryRepository<JourneyDraft>,
    private readonly saveAtomically?: (draft: JourneyDraft, active: Parameters<ReviewHistoryRepository<JourneyDraft>["saveActive"]>[0]) => Promise<void>,
  ) {}

  loadActive() { return this.drafts.loadActive(); }

  async saveActive(draft: JourneyDraft): Promise<void> {
    const previous = await this.reviews.loadActive();
    await this.saveWithLineage(draft, {
      rootId: previous?.rootId ?? draft.id,
      sourceVersionId: previous?.sourceVersionId ?? null,
      title: previous?.title ?? "本次回顾",
    });
  }

  async saveWithLineage(draft: JourneyDraft, lineage: { rootId: string; sourceVersionId: string | null; title: string }): Promise<void> {
    const active = {
      id: `active:${draft.id}`,
      ...lineage,
      updatedAt: draft.updatedAt,
      payload: draft,
    };
    if (this.saveAtomically !== undefined) {
      await this.saveAtomically(draft, active);
      return;
    }
    await this.drafts.saveActive(draft);
    await this.reviews.saveActive(active);
  }

  async deleteActive(): Promise<void> {
    await this.drafts.deleteActive();
    await this.reviews.clearActive();
  }
}

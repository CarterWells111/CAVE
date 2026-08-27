import type { JourneyDraft } from "../../journey/domain/types";
import type { JourneyDraftRepository } from "../../journey/infrastructure/journey-draft-repository";
import type { ReviewHistoryRepository } from "./review-history-repository";

export class VersionedJourneyDraftRepository implements JourneyDraftRepository {
  constructor(
    private readonly drafts: JourneyDraftRepository,
    private readonly reviews: ReviewHistoryRepository<JourneyDraft>,
  ) {}

  loadActive() { return this.drafts.loadActive(); }

  async saveActive(draft: JourneyDraft): Promise<void> {
    const previous = await this.reviews.loadActive();
    await this.drafts.saveActive(draft);
    await this.reviews.saveActive({
      id: `active:${draft.id}`,
      rootId: previous?.rootId ?? draft.id,
      sourceVersionId: previous?.sourceVersionId ?? null,
      title: previous?.title ?? "本次回顾",
      updatedAt: draft.updatedAt,
      payload: draft,
    });
  }

  async deleteActive(): Promise<void> {
    await this.drafts.deleteActive();
    await this.reviews.clearActive();
  }
}

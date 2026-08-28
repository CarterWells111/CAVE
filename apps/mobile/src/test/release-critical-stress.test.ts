import { selectConfirmedCommunicationCard } from "../features/journey/domain/derive-communication-card";
import {
  JOURNEY_PAGE_IDS,
  type JourneyDraft,
  type SavedCommunicationCardMetadata,
  type SavedCommunicationCardRecord
} from "../features/journey/domain/types";
import type {
  CommunicationCardRepository,
  JourneyDraftRepository
} from "../features/journey/infrastructure/journey-draft-repository";
import type {
  JourneyBranchTransaction,
  JourneyCompletionTransaction
} from "../features/journey/infrastructure/journey-write-coordinator";
import {
  composeJourneyRuntime,
  type JourneyRuntime
} from "../features/journey/runtime/journey-runtime";
import type {
  ActiveReview,
  ReviewBranchSeed,
  ReviewHistoryRepository,
  ReviewVersionDetail,
  ReviewVersionInput,
  ReviewVersionMetadata
} from "../features/reviews/infrastructure/review-history-repository";
import type { AppShellState } from "../features/shell/domain/app-shell-state";
import type { AppShellStateRepository } from "../features/shell/infrastructure/app-shell-state-repository";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

class DeterministicNativeBoundary implements JourneyDraftRepository {
  private draft: JourneyDraft | null = null;
  private activeReview: ActiveReview<JourneyDraft> | null = null;
  private shell: AppShellState | null = null;
  private readonly cards = new Map<string, SavedCommunicationCardRecord>();
  private readonly versions = new Map<string, ReviewVersionDetail<JourneyDraft>>();
  failNextCompletion = false;

  async loadActive(): Promise<JourneyDraft | null> {
    return this.draft === null ? null : clone(this.draft);
  }

  async loadActiveReview(): Promise<ActiveReview<JourneyDraft> | null> {
    return this.activeReview === null ? null : clone(this.activeReview);
  }

  async saveActive(draft: JourneyDraft): Promise<void> {
    this.draft = clone(draft);
  }

  async saveReviewActive(active: ActiveReview<JourneyDraft>): Promise<void> {
    this.activeReview = clone(active);
  }

  async deleteActive(): Promise<void> {
    this.draft = null;
  }

  async clearReviewActive(): Promise<void> {
    this.activeReview = null;
  }

  async listCards(): Promise<SavedCommunicationCardRecord[]> {
    return [...this.cards.values()].sort((left, right) =>
      right.savedAt.localeCompare(left.savedAt)).map(clone);
  }

  async listCardMetadata(): Promise<SavedCommunicationCardMetadata[]> {
    return [...this.cards.values()].sort((left, right) =>
      right.savedAt.localeCompare(left.savedAt)).map(({ id, journeyId, savedAt }) => ({
      id, journeyId, savedAt
    }));
  }

  async loadCard(id: string): Promise<SavedCommunicationCardRecord | null> {
    const record = this.cards.get(id);
    return record === undefined ? null : clone(record);
  }

  async saveCard(record: SavedCommunicationCardRecord): Promise<void> {
    this.cards.set(record.id, clone(record));
  }

  async deleteCard(id: string): Promise<void> {
    this.cards.delete(id);
  }

  async loadShell(): Promise<AppShellState | null> {
    return this.shell === null ? null : clone(this.shell);
  }

  async completeInitialJourney(state: AppShellState): Promise<AppShellState> {
    this.shell ??= clone(state);
    return clone(this.shell);
  }

  async clearShell(): Promise<void> {
    this.shell = null;
  }

  async appendVersion(version: ReviewVersionInput<JourneyDraft>): Promise<void> {
    if (!this.versions.has(version.id)) this.versions.set(version.id, clone(version));
  }

  async appendVersionAndClearActive(version: ReviewVersionInput<JourneyDraft>): Promise<void> {
    await this.appendVersion(version);
    this.activeReview = null;
  }

  async listReviewMetadata(): Promise<ReviewVersionMetadata[]> {
    return [...this.versions.values()].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)).map((value) => ({
      id: value.id,
      rootId: value.rootId,
      parentVersionId: value.parentVersionId,
      title: value.title,
      createdAt: value.createdAt,
      status: value.status
    }));
  }

  async loadDetail(id: string): Promise<ReviewVersionDetail<JourneyDraft> | null> {
    const version = this.versions.get(id);
    return version === undefined ? null : clone(version);
  }

  async loadBranchSeed(id: string): Promise<ReviewBranchSeed<JourneyDraft> | null> {
    const version = await this.loadDetail(id);
    return version === null ? null : {
      rootId: version.rootId,
      sourceVersionId: version.id,
      suggestedTitle: version.title,
      payload: version.payload
    };
  }

  async deleteVersion(id: string): Promise<boolean> {
    if (!this.versions.delete(id)) return false;
    for (const [versionId, version] of this.versions) {
      if (version.parentVersionId === id) {
        this.versions.set(versionId, { ...version, parentVersionId: null });
      }
    }
    if (this.activeReview?.sourceVersionId === id) {
      this.activeReview = { ...this.activeReview, sourceVersionId: null };
    }
    return true;
  }

  async clearReviewHistory(): Promise<void> {
    this.activeReview = null;
    this.versions.clear();
  }

  async saveVersionedDraft(
    draft: JourneyDraft,
    active: ActiveReview<JourneyDraft>
  ): Promise<void> {
    this.draft = clone(draft);
    this.activeReview = clone(active);
  }

  async complete(transaction: JourneyCompletionTransaction): Promise<void> {
    if (this.failNextCompletion) {
      this.failNextCompletion = false;
      throw new Error("injected-completion-failure");
    }
    const cards = new Map(this.cards);
    const versions = new Map(this.versions);
    cards.set(transaction.card.id, clone(transaction.card));
    if (!versions.has(transaction.version.id)) {
      versions.set(transaction.version.id, clone(transaction.version));
    }
    this.cards.clear();
    for (const [id, card] of cards) this.cards.set(id, card);
    this.versions.clear();
    for (const [id, version] of versions) this.versions.set(id, version);
    this.shell ??= clone(transaction.shell);
    this.draft = null;
    this.activeReview = null;
  }

  async branch(transaction: JourneyBranchTransaction): Promise<void> {
    const versions = new Map(this.versions);
    if (transaction.archivedActive !== null && !versions.has(transaction.archivedActive.id)) {
      versions.set(transaction.archivedActive.id, clone(transaction.archivedActive));
    }
    this.versions.clear();
    for (const [id, version] of versions) this.versions.set(id, version);
    this.draft = clone(transaction.branch);
    this.activeReview = clone(transaction.active);
  }
}

type ProductionRuntimeStressHarness = Readonly<{
  boundary: DeterministicNativeBoundary;
  runtime: JourneyRuntime;
  reviewMetadata(): Promise<ReviewVersionMetadata[]>;
  activeReview(): Promise<ActiveReview<JourneyDraft> | null>;
  cardMetadata(): Promise<SavedCommunicationCardMetadata[]>;
}>;

function createProductionRuntimeStressHarness(): ProductionRuntimeStressHarness {
  let idSequence = 0;
  let timeSequence = 0;
  const boundary = new DeterministicNativeBoundary();
  const cards: CommunicationCardRepository = {
    list: () => boundary.listCards(),
    listMetadata: () => boundary.listCardMetadata(),
    load: (id) => boundary.loadCard(id),
    save: (record) => boundary.saveCard(record),
    delete: (id) => boundary.deleteCard(id)
  };
  const shellState: AppShellStateRepository = {
    load: () => boundary.loadShell(),
    completeInitialJourney: (state) => boundary.completeInitialJourney(state),
    clear: () => boundary.clearShell()
  };
  const reviewHistory: ReviewHistoryRepository<JourneyDraft> = {
    loadActive: () => boundary.loadActiveReview(),
    saveActive: (active) => boundary.saveReviewActive(active),
    clearActive: () => boundary.clearReviewActive(),
    appendVersion: (version) => boundary.appendVersion(version),
    appendVersionAndClearActive: (version) => boundary.appendVersionAndClearActive(version),
    listMetadata: () => boundary.listReviewMetadata(),
    loadDetail: (id) => boundary.loadDetail(id),
    loadBranchSeed: (id) => boundary.loadBranchSeed(id),
    deleteVersion: (id) => boundary.deleteVersion(id),
    clearAll: () => boundary.clearReviewHistory()
  };
  const runtime = composeJourneyRuntime({
    mode: "native-secure",
    persistence: "sqlcipher-secure-store",
    drafts: boundary,
    cards,
    shellState,
    reviewHistory,
    saveVersionedDraft: (draft, active) => boundary.saveVersionedDraft(draft, active),
    completeJourney: (transaction) => boundary.complete(transaction),
    branchReview: (transaction) => boundary.branch(transaction),
    clipboard: { setStringAsync: async () => undefined },
    createId: () => `journey-${++idSequence}`,
    now: () => new Date(Date.UTC(2026, 7, 28, 10, 0, timeSequence++)).toISOString()
  });
  return {
    boundary,
    runtime,
    reviewMetadata: () => boundary.listReviewMetadata(),
    activeReview: () => boundary.loadActiveReview(),
    cardMetadata: () => boundary.listCardMetadata()
  };
}

describe("release-critical deterministic production-runtime stress", () => {
  it("survives ten reset and start cycles without restoring stale active state", async () => {
    const { boundary, runtime } = createProductionRuntimeStressHarness();

    for (let cycle = 1; cycle <= 10; cycle += 1) {
      await expect(runtime.service.initialize()).resolves.toBe("ready");
      expect(runtime.service.getSnapshot()).toBeNull();

      await runtime.service.confirmAdult();
      expect(runtime.service.getSnapshot()?.id).toBe(`journey-${cycle}`);
      await expect(boundary.loadActiveReview()).resolves.toMatchObject({
        payload: { id: `journey-${cycle}` }
      });

      await runtime.service.resetJourney();
      expect(runtime.service.getSnapshot()).toBeNull();
      await expect(boundary.loadActive()).resolves.toBeNull();
      await expect(boundary.loadActiveReview()).resolves.toBeNull();
    }
  });

  it("repeatedly completes, branches, and deletes versions through runtime transactions", async () => {
    const { runtime, reviewMetadata } = createProductionRuntimeStressHarness();

    for (let cycle = 1; cycle <= 10; cycle += 1) {
      await runtime.service.confirmAdult();
      const rootDraft = runtime.service.getSnapshot()!;
      await runtime.controller.completeInitialJourney(selectConfirmedCommunicationCard(rootDraft));
      const rootId = `review:${rootDraft.id}:completed`;
      const seed = await runtime.reviewHistory.loadBranchSeed(rootId);
      expect(seed).not.toBeNull();

      const branch = {
        ...clone(seed!.payload),
        id: `branch-${cycle}`,
        updatedAt: `2026-08-28T11:${String(cycle).padStart(2, "0")}:00.000Z`
      };
      await runtime.branchFromReview(branch, {
        rootId: seed!.rootId,
        sourceVersionId: seed!.sourceVersionId,
        title: `分支 ${cycle}`
      });
      await runtime.controller.completeInitialJourney(selectConfirmedCommunicationCard(branch));
      const childId = `review:${branch.id}:completed`;
      await expect(runtime.reviewHistory.loadDetail(childId)).resolves.toMatchObject({
        parentVersionId: rootId
      });

      await expect(runtime.reviewHistory.deleteVersion(rootId)).resolves.toBe(true);
      await expect(runtime.reviewHistory.loadDetail(childId)).resolves.toMatchObject({
        parentVersionId: null
      });
      await expect(runtime.reviewHistory.deleteVersion(childId)).resolves.toBe(true);
    }

    await expect(reviewMetadata()).resolves.toEqual([]);
    await expect(runtime.reviewHistory.loadActive()).resolves.toBeNull();
  });

  it("preserves the longest-page payload across seven pages and keeps history lists payload-free", async () => {
    const { runtime, reviewMetadata } = createProductionRuntimeStressHarness();
    const longText = "界".repeat(16_384);

    await runtime.service.confirmAdult();
    await runtime.service.dispatch({ type: "set-overnight-custom-note", note: longText });
    for (const page of JOURNEY_PAGE_IDS) await runtime.service.navigateTo(page);

    const draft = runtime.service.getSnapshot()!;
    expect(draft).toMatchObject({
      currentPage: "final-preparation",
      overnightCustomNote: longText
    });
    await runtime.controller.completeInitialJourney(selectConfirmedCommunicationCard(draft));

    const metadata = await reviewMetadata();
    expect(metadata).toHaveLength(1);
    expect(metadata.every((item) => !("payload" in item))).toBe(true);
    await expect(runtime.reviewHistory.loadDetail(metadata[0]!.id)).resolves.toMatchObject({
      payload: { overnightCustomNote: longText }
    });
  });

  it("recovers from a failed atomic completion without duplicate committed state", async () => {
    const { boundary, runtime, reviewMetadata, activeReview, cardMetadata } =
      createProductionRuntimeStressHarness();
    await runtime.service.confirmAdult();
    const draft = runtime.service.getSnapshot()!;
    const confirmedCard = selectConfirmedCommunicationCard(draft);
    boundary.failNextCompletion = true;

    await expect(runtime.controller.completeInitialJourney(confirmedCard))
      .rejects.toThrow("injected-completion-failure");
    await expect(reviewMetadata()).resolves.toEqual([]);
    await expect(cardMetadata()).resolves.toEqual([]);
    await expect(activeReview()).resolves.toMatchObject({ payload: { id: draft.id } });
    await expect(boundary.loadShell()).resolves.toBeNull();
    expect(runtime.service.getSnapshot()?.id).toBe(draft.id);

    await expect(runtime.controller.completeInitialJourney(confirmedCard)).resolves.toBeUndefined();
    await expect(reviewMetadata()).resolves.toHaveLength(1);
    await expect(cardMetadata()).resolves.toHaveLength(1);
    await expect(activeReview()).resolves.toBeNull();
    await expect(runtime.controller.completeInitialJourney(confirmedCard))
      .rejects.toThrow("journey-not-active");
    await expect(reviewMetadata()).resolves.toHaveLength(1);
    await expect(cardMetadata()).resolves.toHaveLength(1);
  });
});

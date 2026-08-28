import type { AppShellState } from "../../shell/domain/app-shell-state";
import type { ActiveReview, ReviewVersionInput } from "../../reviews/infrastructure/review-history-repository";
import type { JourneyDraft, SavedCommunicationCardRecord } from "../domain/types";

export type JourneyCompletionTransaction = Readonly<{
  draft: JourneyDraft;
  card: SavedCommunicationCardRecord;
  version: ReviewVersionInput<JourneyDraft>;
  shell: AppShellState;
}>;

export interface JourneyWriteCoordinator {
  complete(transaction: JourneyCompletionTransaction): Promise<void>;
}

export type JourneyBranchTransaction = Readonly<{
  archivedActive: ReviewVersionInput<JourneyDraft> | null;
  branch: JourneyDraft;
  active: ActiveReview<JourneyDraft>;
}>;

export interface JourneyBranchWriteCoordinator {
  branch(transaction: JourneyBranchTransaction): Promise<void>;
}

import { createContext, useContext } from "react";

import type { JournalPersistence } from "../../journey/runtime/journey-runtime";

/** Account deletion remains available before adulthood; this capability cannot read journal content. */
export type AccountJournalDeletion = {
  accountId: string;
  journalPersistence: JournalPersistence;
  ensureDeletionCleanup(): Promise<boolean>;
  clearCurrentAccount(): Promise<void>;
};
export const AccountJournalDeletionContext = createContext<AccountJournalDeletion | null>(null);
export const useOptionalAccountJournalDeletion = () => useContext(AccountJournalDeletionContext);

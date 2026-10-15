import { Redirect, useRouter } from "expo-router";

import { useOptionalAccountJournalDeletion } from "../../src/features/account/runtime/account-journal-deletion-context";
import { useAuth } from "../../src/features/auth/runtime/AuthProvider";
import { DeleteAccountScreen } from "../../src/features/auth/ui/DeleteAccountScreen";
import { useJournalAccess } from "../../src/features/journal/runtime/JournalAccessProvider";

export default function DeleteAccountRoute() {
  const router = useRouter();
  const auth = useAuth();
  const journalAccess = useJournalAccess();
  const accountDeletion = useOptionalAccountJournalDeletion();
  if (auth.status === "signedOut") return <Redirect href="/auth/email" />;
  return <DeleteAccountScreen
    createIdempotencyKey={auth.createAccountDeletionIdempotencyKey}
    onBack={() => router.back()}
    onClearCurrentAccountJournal={journalAccess.clearCurrentAccount}
    onEnsureJournalCleanup={journalAccess.ensureDeletionCleanup}
    onComplete={() => router.replace("/settings")}
    onDeleteAccount={async (deletionGrant, idempotencyKey) => {
      if (accountDeletion === null || accountDeletion.accountId !== auth.accountId) throw new Error("assistant-history-deletion-unavailable");
      await accountDeletion.clearCurrentAccountAssistantHistory();
      await auth.deleteAccount(deletionGrant, idempotencyKey);
    }}
    onRequestChallenge={auth.requestAccountDeletionChallenge}
    onVerifyChallenge={auth.verifyAccountDeletionChallenge}
    journalPersistence={journalAccess.journalPersistence}
  />;
}

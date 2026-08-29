import { Redirect, useRouter } from "expo-router";

import { useAuth } from "../../src/features/auth/runtime/AuthProvider";
import { DeleteAccountScreen } from "../../src/features/auth/ui/DeleteAccountScreen";
import { useJournalAccess } from "../../src/features/journal/runtime/JournalAccessProvider";

export default function DeleteAccountRoute() {
  const router = useRouter();
  const auth = useAuth();
  const journalAccess = useJournalAccess();
  if (auth.status === "signedOut") return <Redirect href="/auth/email" />;
  return <DeleteAccountScreen
    createIdempotencyKey={auth.createAccountDeletionIdempotencyKey}
    onBack={() => router.back()}
    onClearCurrentAccountJournal={journalAccess.clearCurrentAccount}
    onComplete={() => router.replace("/settings")}
    onDeleteAccount={auth.deleteAccount}
    onRequestChallenge={auth.requestAccountDeletionChallenge}
    onVerifyChallenge={auth.verifyAccountDeletionChallenge}
    temporaryPreview={journalAccess.temporaryPreview}
  />;
}

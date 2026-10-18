import { useRouter } from "expo-router";
import { useReadyJournalService } from "../../src/features/journal/runtime/JournalAccessProvider";
import { JournalPeriodReviewScreen } from "../../src/features/journal/ui/JournalPeriodReviewScreen";
import { stageJournalPeriodReviewEntry } from "../../src/features/assistant/journal-assistant-entry";
import { useOptionalAuth } from "../../src/features/auth/runtime/AuthProvider";
import { backOrHome } from "../../src/features/shell/ui/safe-navigation";
export default function JournalReviewRoute() {
  const router = useRouter();
  const auth = useOptionalAuth();
  const journalService = useReadyJournalService();
  const openRecord = (id: string) => router.push({ pathname: "/journal/[id]", params: { id } });
  return <JournalPeriodReviewScreen service={journalService} onOpen={openRecord} onBack={() => backOrHome(router)}
    onStartAiReview={(context) => {
      if (!auth?.accountId) return;
      stageJournalPeriodReviewEntry(auth.accountId, context);
      router.navigate("/(tabs)/ai");
    }}
    onSaved={() => router.replace("/(tabs)/journal")} />;
}

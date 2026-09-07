import { useRouter } from "expo-router";
import { useReadyJournalService } from "../../src/features/journal/runtime/JournalAccessProvider";
import { JournalPeriodReviewScreen } from "../../src/features/journal/ui/JournalPeriodReviewScreen";
import { AssistantPanel } from "../../src/features/assistant/AssistantPanel";
export default function JournalReviewRoute() {
  const router = useRouter();
  const journalService = useReadyJournalService();
  const openRecord = (id: string) => router.push({ pathname: "/journal/[id]", params: { id } });
  return <JournalPeriodReviewScreen service={journalService} onOpen={openRecord}
    renderAssistant={(context) => <AssistantPanel {...context} modes={["review"]} onOpenRecord={openRecord} />}
    onSaved={() => router.replace("/(tabs)/journal")} />;
}

import { useRouter } from "expo-router";
import { useReadyJournalService } from "../../src/features/journal/runtime/JournalAccessProvider";
import { JournalPeriodReviewScreen } from "../../src/features/journal/ui/JournalPeriodReviewScreen";
export default function JournalReviewRoute() { const router = useRouter(); const journalService = useReadyJournalService(); return <JournalPeriodReviewScreen service={journalService} onSaved={() => router.replace("/journal" as never)} />; }

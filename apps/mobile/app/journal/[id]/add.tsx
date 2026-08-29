import { useLocalSearchParams, useRouter } from "expo-router";
import { useReadyJournalService } from "../../../src/features/journal/runtime/JournalAccessProvider";
import { JournalEntryEditorScreen } from "../../../src/features/journal/ui/JournalEntryEditorScreen";
export default function AddJournalEntryRoute() { const router = useRouter(); const { id } = useLocalSearchParams<{ id: string }>(); const journalService = useReadyJournalService(); return <JournalEntryEditorScreen recordId={id} service={journalService} onSaved={() => router.replace({ pathname: "/journal/[id]", params: { id } })} />; }

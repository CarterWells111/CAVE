import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useReadyJournalService } from "../../../../src/features/journal/runtime/JournalAccessProvider";
import type { JournalEntry } from "../../../../src/features/journal/domain/journal-record";
import { JournalEntryEditorScreen } from "../../../../src/features/journal/ui/JournalEntryEditorScreen";
import { JournalLoadingScreen } from "../../../../src/features/journal/ui/JournalLoadingScreen";
export default function EditJournalEntryRoute() { const router = useRouter(); const { id, entryId } = useLocalSearchParams<{ id: string; entryId: string }>(); const journalService = useReadyJournalService(); const [entry, setEntry] = useState<JournalEntry | null>(null); useEffect(() => { void journalService.loadEntry(entryId).then(setEntry); }, [entryId, journalService]); if (!entry) return <JournalLoadingScreen message="正在读取本机补充…" />; return <JournalEntryEditorScreen initial={entry} recordId={id} service={journalService} onSaved={() => router.replace({ pathname: "/journal/[id]", params: { id } })} />; }

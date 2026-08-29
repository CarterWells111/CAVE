import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useReadyJournalService } from "../../../src/features/journal/runtime/JournalAccessProvider";
import type { JournalRecord } from "../../../src/features/journal/domain/journal-record";
import { JournalEditorScreen } from "../../../src/features/journal/ui/JournalEditorScreen";
import { JournalLoadingScreen } from "../../../src/features/journal/ui/JournalLoadingScreen";
export default function EditJournalRoute() { const router = useRouter(); const { id } = useLocalSearchParams<{ id: string }>(); const journalService = useReadyJournalService(); const [record, setRecord] = useState<JournalRecord | null>(null); useEffect(() => { void journalService.loadRecord(id).then((value) => setRecord(value?.record ?? null)); }, [id, journalService]); if (!record) return <JournalLoadingScreen message="正在读取本机手记…" />; return <JournalEditorScreen service={journalService} initial={record} onSaved={() => router.replace({ pathname: "/journal/[id]", params: { id } })} />; }

import { useLocalSearchParams, useRouter } from "expo-router";
import { useReadyJournalService } from "../../src/features/journal/runtime/JournalAccessProvider";
import { JournalDetailScreen } from "../../src/features/journal/ui/JournalDetailScreen";
import { backOrHome } from "../../src/features/shell/ui/safe-navigation";

export default function JournalDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const journalService = useReadyJournalService();
  return <JournalDetailScreen
    key={id}
    id={id}
    service={journalService}
    onAdd={() => router.push({ pathname: "/journal/[id]/add", params: { id } })}
    onBack={() => backOrHome(router)}
    onEdit={() => router.push({ pathname: "/journal/[id]/edit", params: { id } })}
    onEditEntry={(entryId) => router.push({ pathname: "/journal/[id]/entry/[entryId]", params: { id, entryId } })}
    onDeleted={() => router.replace("/(tabs)/journal")}
  />;
}

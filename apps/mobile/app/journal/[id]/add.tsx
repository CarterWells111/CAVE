import { useLocalSearchParams, useRouter } from "expo-router";
import { useReadyJournalService } from "../../../src/features/journal/runtime/JournalAccessProvider";
import { JournalEditRouteContent } from "../../../src/features/journal/ui/JournalEditRouteContent";
import { backOrHome } from "../../../src/features/shell/ui/safe-navigation";

export default function AddJournalEntryRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string; entryId: string }>();
  const service = useReadyJournalService();
  return <JournalEditRouteContent id={id} mode="add" service={service}
    onBack={() => backOrHome(router)}
    onSaved={() => router.replace({ pathname: "/journal/[id]", params: { id } })}
  />;
}

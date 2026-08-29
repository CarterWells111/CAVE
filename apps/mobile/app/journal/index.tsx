import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useReadyJournalService } from "../../src/features/journal/runtime/JournalAccessProvider";
import { JournalListScreen } from "../../src/features/journal/ui/JournalListScreen";

export default function JournalIndexRoute() {
  const router = useRouter();
  const journalService = useReadyJournalService();
  const [focusRevision, setFocusRevision] = useState(0);
  const firstFocus = useRef(true);

  useFocusEffect(useCallback(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    setFocusRevision((revision) => revision + 1);
  }, []));

  return <JournalListScreen focusRevision={focusRevision} service={journalService} onCreate={() => router.push("/journal/new")} onOpen={(id) => router.push({ pathname: "/journal/[id]", params: { id } })} onReview={() => router.push("/journal/review")} />;
}

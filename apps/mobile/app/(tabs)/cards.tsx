import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { Screen } from "../../src/core/ui/Screen";
import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { CardsHubScreen } from "../../src/features/shell/ui/CardsHubScreen";
import type { ShellMetadataItem } from "../../src/features/shell/ui/shell-ui-components";

export default function CardsRoute() {
  const router = useRouter();
  const { cards } = useJourneyRuntime();
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [history, setHistory] = useState<ShellMetadataItem[]>([]);
  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      const records = await cards.listMetadata();
      setHistory(records.map((record) => ({ id: record.id, title: "沟通草稿", dateLabel: record.savedAt.slice(0, 10), statusLabel: "仅存本机" })));
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [cards]);
  useEffect(() => { void load(); }, [load]);
  const open = (id: string) => router.push(`/cards/${id}`);
  const edit = (id: string) => router.push(`/cards/${id}?mode=edit`);

  return (
    <Screen>
      <CardsHubScreen
        currentCard={history[0] ?? null}
        history={history}
        loadState={loadState}
        onEdit={edit}
        onOpenHistory={open}
        onRetry={() => { void load(); }}
      />
    </Screen>
  );
}

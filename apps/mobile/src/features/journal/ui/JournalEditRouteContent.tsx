import { useEffect, useState } from "react";
import { View } from "react-native";
import type { JournalService } from "../application/journal-service";
import type { JournalEntry, JournalRecord } from "../domain/journal-record";
import { ErrorState } from "../../../core/ui/ErrorState";
import { Screen } from "../../../core/ui/Screen";
import { SecondaryButton } from "../../../core/ui/secondary-button";
import { JournalEditorScreen } from "./JournalEditorScreen";
import { JournalEntryEditorScreen } from "./JournalEntryEditorScreen";
import { JournalLoadingScreen } from "./JournalLoadingScreen";

type Props = {
  id: string;
  entryId?: string;
  mode: "record" | "entry" | "add";
  service: JournalService;
  onBack(): void;
  onSaved(): void;
};

export function JournalEditRouteContent(props: Props) {
  // A new URL is a new editor. Do not carry a previous record's local form state.
  return <LoadedEditor key={`${props.mode}:${props.id}:${props.entryId ?? ""}`} {...props} />;
}

function LoadedEditor({ id, entryId, mode, service, onBack, onSaved }: Props) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    service: JournalService; record: JournalRecord; entry: JournalEntry | null;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setState(null);
    setFailed(false);
    void (async () => {
      const value = await service.loadRecord(id);
      if (!value) throw new Error("journal-record-not-found");
      const entry = mode === "entry" && entryId ? await service.loadEntry(entryId) : null;
      if (mode === "entry" && (!entry || entry.recordId !== id)) throw new Error("journal-entry-not-found");
      if (active) setState({ service, record: value.record, entry });
    })().catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [id, entryId, mode, service, attempt]);

  if (failed) return <Screen>
    <ErrorState title="无法打开这条手记" message="它可能已经被删除，或本机存储暂时不可用。" actionLabel="重试" onAction={() => setAttempt((n) => n + 1)} />
    <SecondaryButton label="返回手记列表" onPress={onBack} />
  </Screen>;
  if (!state || state.service !== service) return <JournalLoadingScreen message="正在读取本机手记…" />;
  return <View style={{ flex: 1 }}>
    {mode === "record"
      ? <JournalEditorScreen service={service} initial={state.record} onSaved={onSaved} onBack={onBack} />
      : <JournalEntryEditorScreen recordId={id} service={service} onSaved={onSaved} onBack={onBack} {...(state.entry ? { initial: state.entry } : {})} />}
  </View>;
}

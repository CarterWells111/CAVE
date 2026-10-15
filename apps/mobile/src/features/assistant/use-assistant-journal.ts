import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useOptionalJournalAccess } from "../journal/runtime/JournalAccessProvider";
import { AssistantJournalController, type AssistantJournalAccess } from "./assistant-journal";

const unavailable: AssistantJournalAccess = { status: "locked" };

/** Call controller.clear() when starting a new chat or switching history. */
export function useAssistantJournal() {
  const access = useOptionalJournalAccess() ?? unavailable;
  const latest = useRef(access);
  latest.current = access;
  const controller = useMemo(() => new AssistantJournalController(() => latest.current), [access.accountId, access.service, access.status]);
  useEffect(() => { controller.activate(); return () => controller.dispose(); }, [controller]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return { ...state, controller, available: access.status === "ready" && !!access.service };
}

export type AssistantJournal = ReturnType<typeof useAssistantJournal>;

import { createContext, memo, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";

import { useOptionalAuth } from "../auth/runtime/AuthProvider";
import { useAdultDeclaration, useOptionalJourneyRuntime } from "../journey/runtime/JourneyRuntimeProvider";
import type { AssistantHistoryRepository } from "./history/assistant-history-repository";
import { useAssistantHistory, type AssistantHistoryState } from "./use-assistant-history";

const AssistantHistoryContext = createContext<AssistantHistoryState | null>(null);
export type AssistantContextAccess = { allowed: boolean; setAllowed(value: boolean): void };
const AssistantContextAccessContext = createContext<AssistantContextAccess | null>(null);
type AssistantScope = { id: number; listeners: Set<() => void>; ownerAccountId?: string; repository?: AssistantHistoryRepository };
type AssistantSnapshot = { scope: AssistantScope; history: AssistantHistoryState; access: AssistantContextAccess };
let nextScopeId = 0;

export function AssistantHistoryProvider({ children }: PropsWithChildren) {
  const auth = useOptionalAuth();
  const adult = useAdultDeclaration();
  const repository = useOptionalJourneyRuntime()?.assistantHistory;
  const accountId = auth?.accountId;
  const scope = useMemo<AssistantScope>(() => ({
    id: ++nextScopeId, listeners: new Set(),
    ...(accountId ? { ownerAccountId: accountId } : {}),
    ...(repository ? { repository } : {}),
  }), [accountId, adult.status, repository]);
  const [snapshot, setSnapshot] = useState<AssistantSnapshot | null>(null);
  const delegate = useRef<AssistantSnapshot | null>(null);
  const publish = useCallback((next: AssistantSnapshot) => setSnapshot(next), []);
  const empty = useMemo(() => {
    const current = () => delegate.current?.scope === scope ? delegate.current : null;
    const history: AssistantHistoryState = {
      conversations: [], activeId: null, conversationRevision: 0, draft: "", turns: [],
      journeyId: "first-overnight", loading: Boolean(scope.ownerAccountId && scope.repository), busy: false, error: null,
      setDraft: value => { current()?.history.setDraft(value); },
      retry: async () => { await current()?.history.retry(); },
      subscribeToClear: listener => current()?.history.subscribeToClear(listener) ?? (() => undefined),
      selectConversation: id => { current()?.history.selectConversation(id); },
      newConversation: (journeyId, draft) => { current()?.history.newConversation(journeyId, draft); },
      appendTurn: (question, response) => { current()?.history.appendTurn(question, response); },
      removeConversation: async id => await current()?.history.removeConversation(id) ?? false,
      moveConversation: async (id, offset) => await current()?.history.moveConversation(id, offset) ?? false,
    };
    const access: AssistantContextAccess = { allowed: false, setAllowed: value => { current()?.access.setAllowed(value); } };
    return { scope, history, access };
  }, [scope]);
  // Only scoped state remounts. The navigator keeps its identity at account/adult boundaries.
  const visible = snapshot?.scope === scope ? snapshot : empty;
  return <AssistantContextAccessContext.Provider value={visible.access}>
    <AssistantHistoryContext.Provider value={visible.history}>
      <AssistantScopeState key={scope.id} scope={scope} delegate={delegate} publish={publish} />
      {children}
    </AssistantHistoryContext.Provider>
  </AssistantContextAccessContext.Provider>;
}

const AssistantScopeState = memo(function AssistantScopeState({ scope, delegate, publish }: {
  scope: AssistantScope;
  delegate: { current: AssistantSnapshot | null };
  publish(snapshot: AssistantSnapshot): void;
}) {
  const [allowed, setAllowed] = useState(false);
  const access = useMemo(() => ({ allowed, setAllowed }), [allowed]);
  const history = useAssistantHistory({
    journeyId: "first-overnight", initialDraft: "",
    ...(scope.ownerAccountId ? { ownerAccountId: scope.ownerAccountId } : {}),
    ...(scope.repository ? { repository: scope.repository } : {}),
  });
  const subscribeToClear = useCallback((listener: () => void) => {
    scope.listeners.add(listener);
    const unsubscribe = history.subscribeToClear(listener);
    return () => { scope.listeners.delete(listener); unsubscribe(); };
  }, [scope, history.subscribeToClear]);
  const snapshot = { scope, history: { ...history, subscribeToClear }, access };
  delegate.current = snapshot;
  useLayoutEffect(() => { publish(snapshot); });
  useLayoutEffect(() => () => {
    for (const listener of scope.listeners) listener();
    scope.listeners.clear();
  }, [scope]);
  return null;
});

export function useOptionalAssistantHistory() { return useContext(AssistantHistoryContext); }
export function useOptionalAssistantContextAccess() { return useContext(AssistantContextAccessContext); }

export function useAssistantHistorySession() {
  const history = useOptionalAssistantHistory();
  if (!history) throw new Error("AssistantHistoryProvider is required");
  return history;
}

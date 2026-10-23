import { randomUUID } from "expo-crypto";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistantResponse } from "@cave/contracts";

import type { AssistantConversation, AssistantHistoryRepository } from "./history/assistant-history-repository";
import { InMemoryAssistantHistoryRepository } from "./history/in-memory-assistant-history-repository";

export function useAssistantHistory({ repository, ownerAccountId, journeyId, initialDraft, onClear }: {
  repository?: AssistantHistoryRepository;
  ownerAccountId?: string;
  journeyId: string;
  initialDraft: string;
  onClear?(): void;
}) {
  const fallback = useRef<AssistantHistoryRepository>(new InMemoryAssistantHistoryRepository());
  const storage = ownerAccountId && repository ? repository : fallback.current;
  const owner = ownerAccountId ?? "local-preview";
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [conversationRevision, setConversationRevision] = useState(0);
  const [draft, setDraft] = useState(initialDraft);
  const [freshJourneyId, setFreshJourneyId] = useState(journeyId);
  const [loading, setLoading] = useState(storage !== fallback.current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const records = useRef(conversations);
  const currentId = useRef(activeId);
  const currentDraft = useRef(draft);
  const mounted = useRef(true);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const writeEpoch = useRef(0);
  const onClearRef = useRef(onClear);
  onClearRef.current = onClear;
  records.current = conversations;
  currentId.current = activeId;
  currentDraft.current = draft;

  const publish = useCallback((next: AssistantConversation[]) => {
    records.current = next;
    if (mounted.current) setConversations(next);
  }, []);
  const enqueue = (operation: () => Promise<void>) => {
    const task = queue.current.then(operation, operation);
    queue.current = task.catch(() => undefined);
    return task;
  };
  useEffect(() => {
    mounted.current = true;
    let active = true;
    const loadEpoch = writeEpoch.current;
    const unsubscribe = storage.subscribeToOwnerClear?.(owner, () => {
      writeEpoch.current += 1;
      if (!active) return;
      publish([]); currentId.current = null; currentDraft.current = "";
      setActiveId(null); setDraft(""); setError(null);
      setConversationRevision(value => value + 1);
      onClearRef.current?.();
    });
    if (storage !== fallback.current) {
      const load = storage.list(owner).then(saved => {
        if (!active || loadEpoch !== writeEpoch.current) return;
        // A reply can arrive before loading finishes; retain that new conversation.
        const localIds = new Set(records.current.map(item => item.id));
        publish([...records.current, ...saved.filter(item => !localIds.has(item.id))]);
      }).catch(() => {
        if (active) setError("暂时无法读取对话历史，请重试。");
      }).finally(() => { if (active) setLoading(false); });
      queue.current = load;
    }
    return () => {
      active = false; mounted.current = false;
      // Pending saves must still observe deletion after this account leaves the screen.
      void queue.current.then(() => unsubscribe?.(), () => unsubscribe?.());
    };
  }, [owner, storage, publish]);

  const persist = (conversation: AssistantConversation) => {
    const saveEpoch = writeEpoch.current;
    void enqueue(async () => {
      if (saveEpoch !== writeEpoch.current) return;
      await storage.save(owner, conversation);
      // Cleanup can finish while a previously queued SQL write is waiting.
      if (saveEpoch !== writeEpoch.current) await storage.delete(owner, conversation.id);
    }).catch(() => {
      if (mounted.current && saveEpoch === writeEpoch.current) setError("对话暂时未能保存到本机，请重试。");
    });
  };
  const rememberDraft = () => {
    const current = records.current.find(item => item.id === currentId.current);
    if (!current || (current.draft ?? "") === currentDraft.current) return;
    const next = { ...current, draft: currentDraft.current };
    publish(records.current.map(item => item.id === next.id ? next : item));
    persist(next);
  };
  const selectConversation = (id: string) => {
    rememberDraft();
    const conversation = records.current.find(item => item.id === id);
    if (!conversation) return;
    currentId.current = id;
    currentDraft.current = conversation.draft ?? "";
    setActiveId(id);
    setDraft(currentDraft.current);
    setConversationRevision(value => value + 1);
  };
  const newConversation = (nextJourneyId = journeyId, nextDraft = "") => {
    rememberDraft();
    currentId.current = null;
    currentDraft.current = nextDraft;
    setActiveId(null);
    setFreshJourneyId(nextJourneyId);
    setDraft(nextDraft);
    setConversationRevision(value => value + 1);
  };
  const appendTurn = (question: string, response: AssistantResponse) => {
    const previous = records.current.find(item => item.id === currentId.current);
    const now = new Date().toISOString();
    const conversation: AssistantConversation = {
      id: previous?.id ?? randomUUID(),
      title: previous?.title ?? question.replace(/\s+/g, " ").trim().slice(0, 40),
      journeyId: previous?.journeyId ?? freshJourneyId,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
      turns: [...(previous?.turns ?? []), { question, response, createdAt: now }],
      draft: "",
    };
    publish(previous ? records.current.map(item => item.id === conversation.id ? conversation : item) : [conversation, ...records.current]);
    currentId.current = conversation.id;
    currentDraft.current = "";
    setActiveId(conversation.id);
    setDraft("");
    persist(conversation);
  };
  const removeConversation = async (id: string) => {
    setBusy(true); setError(null);
    try {
      await enqueue(async () => {
        await storage.delete(owner, id);
        publish(records.current.filter(item => item.id !== id));
        if (currentId.current === id && mounted.current) {
          currentId.current = null; currentDraft.current = "";
          setActiveId(null); setDraft("");
          setConversationRevision(value => value + 1);
        }
      });
      return true;
    } catch {
      if (mounted.current) setError("未能删除对话，请重试。");
      return false;
    } finally { if (mounted.current) setBusy(false); }
  };
  const moveConversation = async (id: string, offset: -1 | 1) => {
    setBusy(true); setError(null);
    try {
      await enqueue(async () => {
        // Read after queued saves so a new reply cannot make the reorder incomplete.
        const saved = await storage.list(owner);
        const index = saved.findIndex(item => item.id === id);
        const target = index + offset;
        if (index < 0 || target < 0 || target >= saved.length) return;
        [saved[index], saved[target]] = [saved[target]!, saved[index]!];
        const ids = saved.map(item => item.id);
        await storage.reorder(owner, ids);
        const byId = new Map(records.current.map(item => [item.id, item]));
        const savedIds = new Set(ids);
        publish([
          ...records.current.filter(item => !savedIds.has(item.id)),
          ...ids.flatMap(savedId => byId.has(savedId) ? [byId.get(savedId)!] : []),
        ]);
      });
      return true;
    } catch {
      if (mounted.current) setError("未能保存排序，请重试。");
      return false;
    } finally { if (mounted.current) setBusy(false); }
  };
  const retry = async () => {
    setLoading(true); setError(null);
    const saveEpoch = writeEpoch.current;
    try {
      await enqueue(async () => {
        for (const item of records.current) {
          if (saveEpoch !== writeEpoch.current) return;
          await storage.save(owner, item);
          if (saveEpoch !== writeEpoch.current) { await storage.delete(owner, item.id); return; }
        }
        if (saveEpoch !== writeEpoch.current) return;
        const saved = await storage.list(owner);
        if (saveEpoch === writeEpoch.current) publish(saved);
      });
    } catch {
      if (mounted.current) setError("暂时无法保存或读取对话历史，请重试。");
    } finally { if (mounted.current) setLoading(false); }
  };
  const current = conversations.find(item => item.id === activeId);
  const subscribeToClear = useCallback((listener: () => void) => (
    storage.subscribeToOwnerClear?.(owner, listener) ?? (() => undefined)
  ), [owner, storage]);
  return {
    conversations, activeId, conversationRevision, draft, setDraft, loading, busy, error, retry,
    turns: current?.turns ?? [],
    journeyId: current?.journeyId ?? freshJourneyId,
    subscribeToClear,
    selectConversation, newConversation, appendTurn, removeConversation, moveConversation,
  };
}

export type AssistantHistoryState = ReturnType<typeof useAssistantHistory>;

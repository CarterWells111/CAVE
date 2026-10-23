import { AssistantResponseSchema, type AssistantResponse } from "@cave/contracts";
import { z } from "zod";

export type AssistantChatTurn = { question: string; response: AssistantResponse; createdAt?: string };
export type AssistantConversation = {
  id: string;
  title: string;
  journeyId: string;
  createdAt: string;
  updatedAt: string;
  turns: AssistantChatTurn[];
  draft?: string;
};

export interface AssistantHistoryRepository {
  list(ownerAccountId: string): Promise<AssistantConversation[]>;
  save(ownerAccountId: string, conversation: AssistantConversation): Promise<void>;
  delete(ownerAccountId: string, id: string): Promise<void>;
  reorder(ownerAccountId: string, ids: readonly string[]): Promise<void>;
  clearOwner(ownerAccountId: string): Promise<void>;
  clearAll(): Promise<void>;
  subscribeToOwnerClear?(ownerAccountId: string, listener: () => void): () => void;
}

const Identifier = z.string().trim().min(1).max(200);
const ConversationSchema = z.object({
  id: Identifier,
  title: z.string().trim().min(1).max(200),
  journeyId: Identifier,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  turns: z.array(z.object({ question: z.string().trim().min(1).max(1000), response: AssistantResponseSchema, createdAt: z.string().datetime({ offset: true }).optional() }).strict()),
  draft: z.string().max(1000).optional(),
}).strict();

export function validateAssistantHistoryIdentifier(value: string): string {
  const parsed = Identifier.safeParse(value);
  if (!parsed.success || parsed.data !== value) throw new Error("assistant-history-invalid-identifier");
  return parsed.data;
}

export function validateAssistantConversation(value: unknown): AssistantConversation {
  const parsed = ConversationSchema.safeParse(value);
  if (!parsed.success) throw new Error("assistant-history-invalid-conversation");
  const { draft, turns, ...conversation } = parsed.data;
  return {
    ...conversation,
    turns: turns.map(({ createdAt, ...turn }) => ({ ...turn, ...(createdAt === undefined ? {} : { createdAt }) })),
    ...(draft === undefined ? {} : { draft }),
  };
}

export function validateAssistantHistoryOrder(currentIds: readonly string[], ids: readonly string[]): void {
  const current = new Set(currentIds);
  if (ids.length !== currentIds.length || new Set(ids).size !== ids.length || ids.some(id => !current.has(id))) {
    throw new Error("assistant-history-invalid-order");
  }
}


export function createAssistantHistoryClearEvents() {
  const listeners = new Map<string, Set<() => void>>();
  const notifyOwner = (ownerAccountId: string) => {
    for (const listener of [...listeners.get(ownerAccountId) ?? []]) {
      try { listener(); }
      catch { /* A subscriber cannot turn committed deletion into a failed operation. */ }
    }
  };
  return {
    subscribe(ownerAccountId: string, listener: () => void): () => void {
      validateAssistantHistoryIdentifier(ownerAccountId);
      const ownerListeners = listeners.get(ownerAccountId) ?? new Set<() => void>();
      ownerListeners.add(listener);
      listeners.set(ownerAccountId, ownerListeners);
      return () => {
        ownerListeners.delete(listener);
        if (ownerListeners.size === 0) listeners.delete(ownerAccountId);
      };
    },
    notifyOwner,
    notifyAll() { for (const ownerAccountId of [...listeners.keys()]) notifyOwner(ownerAccountId); },
  };
}

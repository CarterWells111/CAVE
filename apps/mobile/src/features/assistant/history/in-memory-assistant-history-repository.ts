import {
  type AssistantConversation,
  type AssistantHistoryRepository,
  createAssistantHistoryClearEvents,
  validateAssistantConversation,
  validateAssistantHistoryIdentifier,
  validateAssistantHistoryOrder,
} from "./assistant-history-repository";

export class InMemoryAssistantHistoryRepository implements AssistantHistoryRepository {
  private readonly clearEvents = createAssistantHistoryClearEvents();

  subscribeToOwnerClear(ownerAccountId: string, listener: () => void): () => void {
    return this.clearEvents.subscribe(ownerAccountId, listener);
  }

  private readonly conversations = new Map<string, AssistantConversation[]>();

  async list(ownerAccountId: string): Promise<AssistantConversation[]> {
    validateAssistantHistoryIdentifier(ownerAccountId);
    return (this.conversations.get(ownerAccountId) ?? []).map(validateAssistantConversation);
  }

  async save(ownerAccountId: string, conversation: AssistantConversation): Promise<void> {
    validateAssistantHistoryIdentifier(ownerAccountId);
    const next = validateAssistantConversation(conversation);
    const current = this.conversations.get(ownerAccountId) ?? [];
    const index = current.findIndex(item => item.id === next.id);
    if (index === -1) current.unshift(next);
    else current[index] = next;
    this.conversations.set(ownerAccountId, current);
  }

  async delete(ownerAccountId: string, id: string): Promise<void> {
    validateAssistantHistoryIdentifier(ownerAccountId);
    validateAssistantHistoryIdentifier(id);
    this.conversations.set(ownerAccountId, (this.conversations.get(ownerAccountId) ?? []).filter(item => item.id !== id));
  }

  async reorder(ownerAccountId: string, ids: readonly string[]): Promise<void> {
    validateAssistantHistoryIdentifier(ownerAccountId);
    const current = this.conversations.get(ownerAccountId) ?? [];
    validateAssistantHistoryOrder(current.map(item => item.id), ids);
    const byId = new Map(current.map(item => [item.id, item]));
    this.conversations.set(ownerAccountId, ids.map(id => byId.get(id)!));
  }

  async clearOwner(ownerAccountId: string): Promise<void> {
    validateAssistantHistoryIdentifier(ownerAccountId);
    this.conversations.delete(ownerAccountId);
    this.clearEvents.notifyOwner(ownerAccountId);
  }

  async clearAll(): Promise<void> {
    this.conversations.clear();
    this.clearEvents.notifyAll();
  }
}

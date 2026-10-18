import type { TransactionalEncryptedDatabaseManager } from "../../../core/storage/database";
import {
  type AssistantConversation,
  type AssistantHistoryRepository,
  createAssistantHistoryClearEvents,
  validateAssistantConversation,
  validateAssistantHistoryIdentifier,
  validateAssistantHistoryOrder,
} from "./assistant-history-repository";

type ConversationRow = { payload_json: string };

export class SqlAssistantHistoryRepository implements AssistantHistoryRepository {
  private readonly clearEvents = createAssistantHistoryClearEvents();

  subscribeToOwnerClear(ownerAccountId: string, listener: () => void): () => void {
    return this.clearEvents.subscribe(ownerAccountId, listener);
  }

  constructor(private readonly database: TransactionalEncryptedDatabaseManager) {}

  async list(ownerAccountId: string): Promise<AssistantConversation[]> {
    validateAssistantHistoryIdentifier(ownerAccountId);
    const rows = await this.database.withTransaction(connection => connection.getAllAsync<ConversationRow>(
      "SELECT payload_json FROM assistant_conversations WHERE owner_account_id=? ORDER BY sort_order ASC, id ASC",
      ownerAccountId,
    ));
    return rows.map(row => {
      try { return validateAssistantConversation(JSON.parse(row.payload_json) as unknown); }
      catch { throw new Error("assistant-history-invalid-conversation"); }
    });
  }

  async save(ownerAccountId: string, conversation: AssistantConversation): Promise<void> {
    validateAssistantHistoryIdentifier(ownerAccountId);
    const next = validateAssistantConversation(conversation);
    await this.database.withTransaction(async connection => {
      const existing = await connection.getFirstAsync<{ id: string }>(
        "SELECT id FROM assistant_conversations WHERE owner_account_id=? AND id=?", ownerAccountId, next.id,
      );
      if (existing !== null) {
        await connection.runAsync(
          "UPDATE assistant_conversations SET payload_json=? WHERE owner_account_id=? AND id=?",
          JSON.stringify(next), ownerAccountId, next.id,
        );
      } else {
        await connection.runAsync(
          "INSERT INTO assistant_conversations (owner_account_id,id,payload_json,sort_order) SELECT ?,?,?,COALESCE(MIN(sort_order),0)-1 FROM assistant_conversations WHERE owner_account_id=?",
          ownerAccountId, next.id, JSON.stringify(next), ownerAccountId,
        );
      }
    });
  }

  async delete(ownerAccountId: string, id: string): Promise<void> {
    validateAssistantHistoryIdentifier(ownerAccountId);
    validateAssistantHistoryIdentifier(id);
    const connection = await this.database.initialize();
    await connection.runAsync("DELETE FROM assistant_conversations WHERE owner_account_id=? AND id=?", ownerAccountId, id);
  }

  async reorder(ownerAccountId: string, ids: readonly string[]): Promise<void> {
    validateAssistantHistoryIdentifier(ownerAccountId);
    await this.database.withTransaction(async connection => {
      const rows = await connection.getAllAsync<{ id: string }>(
        "SELECT id FROM assistant_conversations WHERE owner_account_id=? ORDER BY sort_order ASC, id ASC", ownerAccountId,
      );
      validateAssistantHistoryOrder(rows.map(row => row.id), ids);
      for (const [position, id] of ids.entries()) {
        await connection.runAsync(
          "UPDATE assistant_conversations SET sort_order=? WHERE owner_account_id=? AND id=?", position, ownerAccountId, id,
        );
      }
    });
  }

  async clearOwner(ownerAccountId: string): Promise<void> {
    validateAssistantHistoryIdentifier(ownerAccountId);
    const connection = await this.database.initialize();
    await connection.runAsync("DELETE FROM assistant_conversations WHERE owner_account_id=?", ownerAccountId);
    this.clearEvents.notifyOwner(ownerAccountId);
  }

  async clearAll(): Promise<void> {
    const connection = await this.database.initialize();
    await connection.runAsync("DELETE FROM assistant_conversations");
    this.clearEvents.notifyAll();
  }
}

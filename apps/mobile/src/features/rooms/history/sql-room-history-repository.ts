import type { TransactionalEncryptedDatabaseManager } from "../../../core/storage/database";
import {
  createRoomHistoryLifecycle, validateRoomHistoryIdentifier, validateRoomHistoryRecord,
  type RoomHistoryRecord, type RoomHistoryRepository,
} from "./room-history-repository";

export class SqlRoomHistoryRepository implements RoomHistoryRepository {
  private readonly lifecycle = createRoomHistoryLifecycle();
  constructor(private readonly database: TransactionalEncryptedDatabaseManager) {}

  subscribeToOwnerClear(ownerAccountId: string, listener: () => void): () => void {
    return this.lifecycle.subscribe(ownerAccountId, listener);
  }

  async list(ownerAccountId: string): Promise<readonly RoomHistoryRecord[]> {
    validateRoomHistoryIdentifier(ownerAccountId);
    const rows = await this.database.withTransaction(connection => connection.getAllAsync<{ payload_json: string }>(
      "SELECT payload_json FROM room_history WHERE owner_account_id=? ORDER BY occurred_at DESC,id DESC", ownerAccountId,
    ));
    return rows.map(row => {
      try { return validateRoomHistoryRecord(JSON.parse(row.payload_json) as unknown); }
      catch { throw new Error("room-history-invalid-record"); }
    });
  }

  async save(ownerAccountId: string, record: RoomHistoryRecord): Promise<void> {
    validateRoomHistoryIdentifier(ownerAccountId);
    const next = validateRoomHistoryRecord(record);
    const isCurrent = this.lifecycle.capture(ownerAccountId);
    if (!isCurrent()) return;
    await this.database.withTransaction(async connection => {
      if (!isCurrent()) return;
      await connection.runAsync(
        "INSERT INTO room_history (owner_account_id,id,occurred_at,payload_json) VALUES (?,?,?,?) ON CONFLICT(owner_account_id,id) DO NOTHING",
        ownerAccountId, next.id, next.occurredAt, JSON.stringify(next),
      );
    });
  }

  async clearOwner(ownerAccountId: string): Promise<void> {
    validateRoomHistoryIdentifier(ownerAccountId);
    const finish = this.lifecycle.beginClear(ownerAccountId);
    try {
      await this.database.withTransaction(connection => connection.runAsync(
        "DELETE FROM room_history WHERE owner_account_id=?", ownerAccountId,
      ));
      this.lifecycle.notifyOwner(ownerAccountId);
    } finally { finish(); }
  }

  async withStorageDeletion(operation: () => Promise<void>): Promise<void> {
    const finish = this.lifecycle.beginClear();
    try {
      await operation();
      this.lifecycle.notifyAll();
    } finally { finish(); }
  }

  async clearAll(): Promise<void> {
    const finish = this.lifecycle.beginClear();
    try {
      await this.database.withTransaction(connection => connection.runAsync("DELETE FROM room_history"));
      this.lifecycle.notifyAll();
    } finally { finish(); }
  }
}

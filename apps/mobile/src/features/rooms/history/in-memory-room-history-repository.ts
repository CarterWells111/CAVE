import {
  createRoomHistoryLifecycle, validateRoomHistoryIdentifier, validateRoomHistoryRecord,
  type RoomHistoryRecord, type RoomHistoryRepository,
} from "./room-history-repository";

export class InMemoryRoomHistoryRepository implements RoomHistoryRepository {
  private readonly records = new Map<string, Map<string, RoomHistoryRecord>>();
  private readonly lifecycle = createRoomHistoryLifecycle();

  subscribeToOwnerClear(ownerAccountId: string, listener: () => void): () => void {
    return this.lifecycle.subscribe(ownerAccountId, listener);
  }

  async list(ownerAccountId: string): Promise<readonly RoomHistoryRecord[]> {
    validateRoomHistoryIdentifier(ownerAccountId);
    return [...this.records.get(ownerAccountId)?.values() ?? []]
      .map(validateRoomHistoryRecord)
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.id.localeCompare(left.id));
  }

  async save(ownerAccountId: string, record: RoomHistoryRecord): Promise<void> {
    validateRoomHistoryIdentifier(ownerAccountId);
    const next = validateRoomHistoryRecord(record);
    if (!this.lifecycle.capture(ownerAccountId)()) return;
    const records = this.records.get(ownerAccountId) ?? new Map<string, RoomHistoryRecord>();
    // Each id denotes one real event. Repeated delivery must not change its time.
    if (!records.has(next.id)) records.set(next.id, next);
    this.records.set(ownerAccountId, records);
  }

  async clearOwner(ownerAccountId: string): Promise<void> {
    validateRoomHistoryIdentifier(ownerAccountId);
    const finish = this.lifecycle.beginClear(ownerAccountId);
    try {
      this.records.delete(ownerAccountId);
      this.lifecycle.notifyOwner(ownerAccountId);
    } finally { finish(); }
  }

  async clearAll(): Promise<void> {
    const finish = this.lifecycle.beginClear();
    try {
      this.records.clear();
      this.lifecycle.notifyAll();
    } finally { finish(); }
  }
}

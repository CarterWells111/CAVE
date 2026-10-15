import type { TransactionalEncryptedDatabaseManager } from "../../core/storage/database";
import {
  normalizePreferenceCard,
  type PreferenceCard,
  type PreferenceCardRepository,
} from "./preference-card";

type PreferenceCardRow = { payload_json: string };

export class SqlPreferenceCardRepository implements PreferenceCardRepository {
  constructor(private readonly database: TransactionalEncryptedDatabaseManager) {}

  async load(ownerId: string): Promise<PreferenceCard | null> {
    const connection = await this.database.initialize();
    const row = await connection.getFirstAsync<PreferenceCardRow>(
      "SELECT payload_json FROM journey_preference_cards WHERE owner_id = ?",
      ownerId,
    );
    return row === null ? null : normalizePreferenceCard(JSON.parse(row.payload_json));
  }

  async save(ownerId: string, card: PreferenceCard): Promise<void> {
    const connection = await this.database.initialize();
    await connection.runAsync(
      "INSERT INTO journey_preference_cards (owner_id, payload_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(owner_id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at",
      ownerId,
      JSON.stringify(normalizePreferenceCard(card)),
      new Date().toISOString(),
    );
  }

  async clearAll(): Promise<void> {
    const connection = await this.database.initialize();
    await connection.runAsync("DELETE FROM journey_preference_cards");
  }
}

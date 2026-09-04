import type { AccountPreferences, UpdateAccountPreferencesRequest } from "@cave/contracts";

export interface AccountPreferencesRepository {
  get(accountId: string): Promise<AccountPreferences>;
  update(accountId: string, input: UpdateAccountPreferencesRequest, updatedAt: string): Promise<AccountPreferences | null>;
}

type PreferencesRow = {
  age_confirmed: number;
  address_preference: AccountPreferences["addressPreference"];
  updated_at: string | null;
  revision: number;
};

function fromRow(row: PreferencesRow): AccountPreferences {
  return { ageConfirmed: row.age_confirmed === 1, addressPreference: row.address_preference, updatedAt: row.updated_at, revision: row.revision };
}

export class D1AccountPreferencesRepository implements AccountPreferencesRepository {
  constructor(private readonly database: D1Database) {}

  async get(accountId: string): Promise<AccountPreferences> {
    const row = await this.database.prepare(
      "SELECT age_confirmed, address_preference, updated_at, revision FROM account_preferences WHERE account_id = ?",
    ).bind(accountId).first<PreferencesRow>();
    return row === null
      ? { ageConfirmed: false, addressPreference: null, updatedAt: null, revision: 0 }
      : fromRow(row);
  }

  async update(accountId: string, input: UpdateAccountPreferencesRequest, updatedAt: string): Promise<AccountPreferences | null> {
    // One SQLite statement performs compare-and-swap, including the first write.
    // The SELECT prevents an absent row from accepting a nonzero revision.
    const row = await this.database.prepare(`
      INSERT INTO account_preferences (account_id, age_confirmed, address_preference, updated_at, revision)
      SELECT ?, ?, ?, ?, 1
      WHERE ? = 0 OR EXISTS (SELECT 1 FROM account_preferences WHERE account_id = ?)
      ON CONFLICT(account_id) DO UPDATE SET
        age_confirmed = CASE WHEN ? THEN excluded.age_confirmed ELSE account_preferences.age_confirmed END,
        address_preference = CASE WHEN ? THEN excluded.address_preference ELSE account_preferences.address_preference END,
        updated_at = excluded.updated_at,
        revision = account_preferences.revision + 1
      WHERE account_preferences.revision = ?
      RETURNING age_confirmed, address_preference, updated_at, revision
    `).bind(
      accountId, input.changes.ageConfirmed === true ? 1 : 0,
      input.changes.addressPreference ?? null, updatedAt, input.expectedRevision, accountId,
      input.changes.ageConfirmed === undefined ? 0 : 1,
      input.changes.addressPreference === undefined ? 0 : 1,
      input.expectedRevision,
    ).first<PreferencesRow>();
    return row === null ? null : fromRow(row);
  }
}

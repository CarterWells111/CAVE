export const CURRENT_SCHEMA_VERSION = 12;

export type MigrationCallbackConnection = {
  runAsync(sql: string, ...params: unknown[]): Promise<{ changes: number }>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
};

export type DatabaseMigration = {
  version: number;
  schema: string;
  afterSchema?: (connection: MigrationCallbackConnection) => Promise<void>;
};

export const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS course_progress (
  lesson_id TEXT PRIMARY KEY NOT NULL,
  completed_at TEXT NOT NULL,
  quiz_correct INTEGER NOT NULL,
  quiz_total INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS saved_records (
  id TEXT PRIMARY KEY NOT NULL,
  scenario_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expression_card TEXT NOT NULL,
  transcript TEXT
);
CREATE TABLE IF NOT EXISTS privacy_settings (
  singleton_id INTEGER PRIMARY KEY NOT NULL CHECK (singleton_id = 1),
  live_model_acknowledged INTEGER NOT NULL,
  default_save_transcript INTEGER NOT NULL CHECK (default_save_transcript = 0)
);`;

export const SCHEMA_V2 = `
CREATE TABLE IF NOT EXISTS journey_drafts (
  id TEXT PRIMARY KEY NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS journey_cards (
  id TEXT PRIMARY KEY NOT NULL,
  journey_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  saved_at TEXT NOT NULL
);`;

export const SCHEMA_V3 = `
CREATE TABLE IF NOT EXISTS journey_drafts_v2 (
  id TEXT PRIMARY KEY NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version = 2),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS journey_migration_receipts (
  migration_id TEXT PRIMARY KEY NOT NULL,
  source_draft_id TEXT NOT NULL,
  target_draft_id TEXT NOT NULL,
  source_schema_version INTEGER NOT NULL,
  target_schema_version INTEGER NOT NULL,
  migrated_at TEXT NOT NULL
);`;

export const SCHEMA_V4 = `
CREATE TABLE IF NOT EXISTS app_shell_state (
  singleton_id INTEGER PRIMARY KEY NOT NULL CHECK (singleton_id = 1),
  initial_journey_completed_at TEXT NOT NULL,
  initial_journey_id TEXT NOT NULL
);`;

export const SCHEMA_V5 = `
CREATE TABLE IF NOT EXISTS journey_active_review (
  singleton_id INTEGER PRIMARY KEY NOT NULL CHECK (singleton_id = 1),
  root_id TEXT NOT NULL,
  base_version_id TEXT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS journey_review_versions (
  id TEXT PRIMARY KEY NOT NULL,
  root_id TEXT NOT NULL,
  parent_version_id TEXT REFERENCES journey_review_versions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  review_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'incomplete')),
  payload TEXT NOT NULL,
  source_revision INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS journey_review_versions_metadata
  ON journey_review_versions(review_date DESC, created_at DESC);
CREATE TABLE IF NOT EXISTS review_migration_receipts (
  source_id TEXT PRIMARY KEY NOT NULL,
  target_version_id TEXT NOT NULL,
  migrated_at TEXT NOT NULL
);`;

export const SCHEMA_V6 = `
CREATE TABLE IF NOT EXISTS app_preferences (
  singleton_id INTEGER PRIMARY KEY NOT NULL CHECK (singleton_id = 1),
  theme_preference TEXT NOT NULL CHECK (theme_preference IN ('system', 'light', 'dark'))
);`;

export const SCHEMA_V7 = `
CREATE TABLE IF NOT EXISTS journey_drafts_v3 (
  id TEXT PRIMARY KEY NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version = 3),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`;

export const SCHEMA_V8 = `
CREATE TABLE IF NOT EXISTS app_preferences (
  singleton_id INTEGER PRIMARY KEY NOT NULL CHECK (singleton_id = 1),
  theme_preference TEXT NOT NULL CHECK (theme_preference IN ('system', 'light', 'dark'))
);
CREATE TABLE IF NOT EXISTS local_journal_preferences (
  singleton_id INTEGER PRIMARY KEY NOT NULL CHECK (singleton_id = 1),
  show_save_notice INTEGER NOT NULL CHECK (show_save_notice IN (0, 1))
);`;

export const SCHEMA_V9 = `
CREATE TABLE IF NOT EXISTS local_journal_preferences (
  singleton_id INTEGER PRIMARY KEY NOT NULL CHECK (singleton_id = 1),
  show_save_notice INTEGER NOT NULL CHECK (show_save_notice IN (0, 1))
);`;

export const SCHEMA_V10 = `
CREATE TABLE IF NOT EXISTS journey_drafts_v4 (
  id TEXT PRIMARY KEY NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version = 4),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`;

export const SCHEMA_V11 = `
CREATE TABLE IF NOT EXISTS journal_records (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  editable_until TEXT NOT NULL,
  highlight_kind TEXT NOT NULL CHECK (highlight_kind IN ('feeling', 'impression')),
  highlight_text TEXT NOT NULL,
  body TEXT NOT NULL,
  topics_json TEXT NOT NULL,
  source_json TEXT NOT NULL,
  card_snapshot_json TEXT,
  owner_account_id TEXT
);
CREATE INDEX IF NOT EXISTS journal_records_occurred_at_idx ON journal_records(occurred_at DESC);
CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY NOT NULL,
  record_id TEXT NOT NULL REFERENCES journal_records(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('event-change', 'feeling-change', 'action', 'insight', 'correction')),
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  editable_until TEXT NOT NULL,
  highlight_json TEXT,
  body TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS journal_entries_record_time_idx ON journal_entries(record_id, occurred_at, created_at);
CREATE TABLE IF NOT EXISTS journal_period_reviews (
  id TEXT PRIMARY KEY NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  editable_until TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  source_record_ids_json TEXT NOT NULL,
  owner_account_id TEXT
);`;

export const SCHEMA_V12 = `SELECT 1;`;

type TableInfoRow = { name: string };

async function copyLegacyJournalPreference(
  connection: MigrationCallbackConnection
): Promise<void> {
  const columns = await connection.getAllAsync<TableInfoRow>(
    "PRAGMA table_info(privacy_settings)"
  );
  if (!columns.some(({ name }) => name === "show_local_journal_save_notice")) return;

  await connection.runAsync(`
INSERT INTO local_journal_preferences (singleton_id, show_save_notice)
SELECT singleton_id, show_local_journal_save_notice
FROM privacy_settings
WHERE singleton_id = 1
ON CONFLICT(singleton_id) DO NOTHING`);
}

async function ensureJournalOwnership(
  connection: MigrationCallbackConnection
): Promise<void> {
  const recordColumns = await connection.getAllAsync<TableInfoRow>(
    "PRAGMA table_info(journal_records)"
  );
  if (!recordColumns.some(({ name }) => name === "owner_account_id")) {
    await connection.runAsync(
      "ALTER TABLE journal_records ADD COLUMN owner_account_id TEXT"
    );
  }

  const reviewColumns = await connection.getAllAsync<TableInfoRow>(
    "PRAGMA table_info(journal_period_reviews)"
  );
  if (!reviewColumns.some(({ name }) => name === "owner_account_id")) {
    await connection.runAsync(
      "ALTER TABLE journal_period_reviews ADD COLUMN owner_account_id TEXT"
    );
  }

  await connection.runAsync(`CREATE INDEX IF NOT EXISTS journal_records_owner_date_idx
ON journal_records(owner_account_id, occurred_at DESC, created_at DESC)`);
  await connection.runAsync(`CREATE INDEX IF NOT EXISTS journal_period_reviews_owner_created_idx
ON journal_period_reviews(owner_account_id, created_at DESC)`);
}

export const DATABASE_MIGRATIONS: readonly DatabaseMigration[] = [
  { version: 1, schema: SCHEMA_V1 },
  { version: 2, schema: SCHEMA_V2 },
  { version: 3, schema: SCHEMA_V3 },
  { version: 4, schema: SCHEMA_V4 },
  { version: 5, schema: SCHEMA_V5 },
  { version: 6, schema: SCHEMA_V6 },
  { version: 7, schema: SCHEMA_V7 },
  { version: 8, schema: SCHEMA_V8 },
  { version: 9, schema: SCHEMA_V9, afterSchema: copyLegacyJournalPreference },
  { version: 10, schema: SCHEMA_V10 },
  { version: 11, schema: SCHEMA_V11 },
  { version: 12, schema: SCHEMA_V12, afterSchema: ensureJournalOwnership }
];

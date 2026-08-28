export const CURRENT_SCHEMA_VERSION = 8;

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
ALTER TABLE privacy_settings
ADD COLUMN show_local_journal_save_notice INTEGER NOT NULL DEFAULT 1
CHECK (show_local_journal_save_notice IN (0, 1));`;

export const DATABASE_MIGRATIONS = [
  { version: 1, schema: SCHEMA_V1 },
  { version: 2, schema: SCHEMA_V2 },
  { version: 3, schema: SCHEMA_V3 },
  { version: 4, schema: SCHEMA_V4 },
  { version: 5, schema: SCHEMA_V5 },
  { version: 6, schema: SCHEMA_V6 },
  { version: 7, schema: SCHEMA_V7 },
  { version: 8, schema: SCHEMA_V8 }
] as const;

export const CURRENT_SCHEMA_VERSION = 2;

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

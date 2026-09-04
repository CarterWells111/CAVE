// Frozen SQL from the commits cited below. Deliberately independent of the live migration registry.
// Synthetic records only; these fixtures contain no user information or encryption keys.
export type HistoricalDatabaseFixture = {
  id: string;
  version: number;
  schemaSql: string;
  seedSql: string;
};

// Source: 6f642c9
const V1 = `
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

// Source: 54e2be7
const V2 = `
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

// Source: d4c3d3e
const V3 = `
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

// Source: 1090bf6
const V4 = `
CREATE TABLE IF NOT EXISTS app_shell_state (
  singleton_id INTEGER PRIMARY KEY NOT NULL CHECK (singleton_id = 1),
  initial_journey_completed_at TEXT NOT NULL,
  initial_journey_id TEXT NOT NULL
);`;

// Source: bb5d9cb
const V5 = `
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

// Source: 2fe3b26
const V6 = `
CREATE TABLE IF NOT EXISTS app_preferences (
  singleton_id INTEGER PRIMARY KEY NOT NULL CHECK (singleton_id = 1),
  theme_preference TEXT NOT NULL CHECK (theme_preference IN ('system', 'light', 'dark'))
);`;

// Source: a814443
const V7 = `
CREATE TABLE IF NOT EXISTS journey_drafts_v3 (
  id TEXT PRIMARY KEY NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version = 3),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`;

// Source: 03ed836
const V8 = `
CREATE TABLE IF NOT EXISTS app_preferences (
  singleton_id INTEGER PRIMARY KEY NOT NULL CHECK (singleton_id = 1),
  theme_preference TEXT NOT NULL CHECK (theme_preference IN ('system', 'light', 'dark'))
);
CREATE TABLE IF NOT EXISTS local_journal_preferences (
  singleton_id INTEGER PRIMARY KEY NOT NULL CHECK (singleton_id = 1),
  show_save_notice INTEGER NOT NULL CHECK (show_save_notice IN (0, 1))
);`;

// Source: d14fd32
const V9 = `
CREATE TABLE IF NOT EXISTS local_journal_preferences (
  singleton_id INTEGER PRIMARY KEY NOT NULL CHECK (singleton_id = 1),
  show_save_notice INTEGER NOT NULL CHECK (show_save_notice IN (0, 1))
);`;

// Source: d14fd32
const V10 = `
CREATE TABLE IF NOT EXISTS journey_drafts_v4 (
  id TEXT PRIMARY KEY NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version = 4),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`;

// Source: 59cdc4f (journal schema before ownership was introduced)
const V11 = `
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
  card_snapshot_json TEXT
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
  source_record_ids_json TEXT NOT NULL
);`;

const LEGACY_V8 = `
ALTER TABLE privacy_settings
ADD COLUMN show_local_journal_save_notice INTEGER NOT NULL DEFAULT 1
CHECK (show_local_journal_save_notice IN (0, 1));`;
const OWNERSHIP = `
ALTER TABLE journal_records ADD COLUMN owner_account_id TEXT;
ALTER TABLE journal_period_reviews ADD COLUMN owner_account_id TEXT;
CREATE INDEX IF NOT EXISTS journal_records_owner_date_idx
  ON journal_records(owner_account_id, occurred_at DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS journal_period_reviews_owner_created_idx
  ON journal_period_reviews(owner_account_id, created_at DESC);`;

const schemaByVersion = [V1, V2, V3, V4, V5, V6, V7, V8, V9, V10, V11, OWNERSHIP];
const seedsByVersion = [
  `INSERT INTO course_progress VALUES ('lesson-fixture', '2026-01-01', 2, 3);
INSERT INTO saved_records VALUES ('saved-fixture', 'scenario-fixture', '2026-01-01', '{"text":"synthetic card"}', 'synthetic transcript');
INSERT INTO privacy_settings (singleton_id,live_model_acknowledged,default_save_transcript) VALUES (1, 1, 0);`,
  `INSERT INTO journey_drafts VALUES ('draft-v1',1,'{"fixture":1}','2026-01-01','2026-01-02');
INSERT INTO journey_cards VALUES ('card-fixture','draft-v1','{"text":"synthetic"}','2026-01-02');`,
  `INSERT INTO journey_drafts_v2 VALUES ('draft-v2',2,'{"fixture":2}','2026-01-01','2026-01-02');
INSERT INTO journey_migration_receipts VALUES ('receipt-fixture','draft-v1','draft-v2',1,2,'2026-01-02');`,
  `INSERT INTO app_shell_state VALUES (1,'2026-01-02','draft-v2');`,
  `INSERT INTO journey_review_versions VALUES ('review-parent','root-fixture',NULL,'parent','2026-01-01','completed','{}',1,'2026-01-01');
INSERT INTO journey_review_versions VALUES ('review-child','root-fixture','review-parent','child','2026-01-02','incomplete','{}',2,'2026-01-02');
INSERT INTO journey_active_review VALUES (1,'root-fixture','review-child','{}','2026-01-02','2026-01-02');
INSERT INTO review_migration_receipts VALUES ('draft-v2','review-parent','2026-01-02');`,
  `INSERT INTO app_preferences VALUES (1,'dark');`,
  `INSERT INTO journey_drafts_v3 VALUES ('draft-v3',3,'{"fixture":3}','2026-01-01','2026-01-02');`,
  `INSERT INTO local_journal_preferences VALUES (1,0);`,
  '',
  `INSERT INTO journey_drafts_v4 VALUES ('draft-v4',4,'{"fixture":4}','2026-01-01','2026-01-02');`,
  `INSERT INTO journal_records VALUES ('journal-fixture','Synthetic journal','2026-01-01','2026-01-01','2026-01-01','2026-01-02','feeling','calm','synthetic body','[]','{}',NULL);
INSERT INTO journal_entries VALUES ('entry-fixture','journal-fixture','insight','2026-01-02','2026-01-02','2026-01-02','2026-01-03',NULL,'synthetic follow-up');
INSERT INTO journal_period_reviews VALUES ('period-fixture','2026-01-01','2026-01-07','2026-01-07','2026-01-07','2026-01-08','Synthetic week','synthetic reflection','["journal-fixture"]');`,
  `UPDATE journal_records SET owner_account_id='account-fixture';
UPDATE journal_period_reviews SET owner_account_id='account-fixture';`
];

function fixture(version: number): HistoricalDatabaseFixture {
  // Insert the unowned v11 rows before adding the v12 columns.
  const schemaSql = schemaByVersion.slice(0, Math.min(version, 11)).join('\n');
  return { id: `v${version}`, version,
    schemaSql,
    seedSql: seedsByVersion.slice(0, Math.min(version, 11)).join('\n')
      + (version === 12 ? OWNERSHIP + seedsByVersion[11] : '') };
}

export const HISTORICAL_DATABASE_FIXTURES: readonly HistoricalDatabaseFixture[] = [
  ...Array.from({ length: 12 }, (_, index) => fixture(index + 1)),
  { ...fixture(6), id: 'v6-legacy-collision',
    schemaSql: [V1,V2,V3,V4,V5,V7,LEGACY_V8].join('\n'),
    seedSql: seedsByVersion.slice(0,5).join('\n') + seedsByVersion[6]
      + 'UPDATE privacy_settings SET show_local_journal_save_notice=0;' },
  { ...fixture(8), id: 'v8-legacy-preference-off',
    schemaSql: [V1,V2,V3,V4,V5,V6,V7,LEGACY_V8].join('\n'),
    seedSql: seedsByVersion.slice(0,7).join('\n')
      + 'UPDATE privacy_settings SET show_local_journal_save_notice=0;' },
  { ...fixture(8), id: 'v8-legacy-preference-on',
    schemaSql: [V1,V2,V3,V4,V5,V6,V7,LEGACY_V8].join('\n'),
    seedSql: seedsByVersion.slice(0,7).join('\n') },
  { ...fixture(8), id: 'v8-legacy-preference-conflict',
    schemaSql: fixture(8).schemaSql + LEGACY_V8,
    seedSql: fixture(8).seedSql + 'UPDATE privacy_settings SET show_local_journal_save_notice=1;' }
];

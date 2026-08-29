PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS auth_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  email_lookup TEXT NOT NULL,
  email_lookup_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (email_lookup_version, email_lookup)
);

CREATE TABLE IF NOT EXISTS auth_email_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT REFERENCES auth_accounts(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('sign_in', 'account_delete')),
  email_lookup TEXT NOT NULL,
  email_lookup_version INTEGER NOT NULL,
  installation_digest TEXT NOT NULL,
  code_digest TEXT NOT NULL,
  otp_key_version INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  attempts_remaining INTEGER NOT NULL CHECK (attempts_remaining BETWEEN 0 AND 5),
  created_at TEXT NOT NULL,
  consumed_at TEXT,
  invalidated_at TEXT
);
CREATE INDEX IF NOT EXISTS auth_challenge_lookup
  ON auth_email_challenges(email_lookup_version, email_lookup, purpose, created_at DESC);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
  access_digest TEXT NOT NULL UNIQUE,
  access_expires_at TEXT NOT NULL,
  refresh_digest TEXT NOT NULL UNIQUE,
  previous_refresh_digest TEXT,
  previous_refresh_valid_until TEXT,
  refresh_expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS auth_session_account ON auth_sessions(account_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS auth_session_previous_refresh ON auth_sessions(previous_refresh_digest);

CREATE TABLE IF NOT EXISTS auth_rate_buckets (
  scope TEXT NOT NULL,
  key_digest TEXT NOT NULL,
  window_started_at TEXT NOT NULL,
  count INTEGER NOT NULL CHECK (count >= 0),
  expires_at TEXT NOT NULL,
  PRIMARY KEY (scope, key_digest, window_started_at)
);

CREATE TABLE IF NOT EXISTS auth_email_suppressions (
  email_lookup TEXT NOT NULL,
  email_lookup_version INTEGER NOT NULL,
  reason_code TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (email_lookup_version, email_lookup)
);

CREATE TABLE IF NOT EXISTS auth_deletion_grants (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
  grant_digest TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE TABLE IF NOT EXISTS auth_deletion_receipts (
  idempotency_digest TEXT PRIMARY KEY NOT NULL,
  grant_digest TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

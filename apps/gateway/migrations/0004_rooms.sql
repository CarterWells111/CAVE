PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY NOT NULL,
  scenario TEXT NOT NULL CHECK (scenario IN ('first-overnight', 'pause', 'adjust')),
  owner_account_id TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
  invitee_account_id TEXT REFERENCES auth_accounts(id) ON DELETE CASCADE,
  invitation_digest TEXT NOT NULL UNIQUE,
  invitation_expires_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  joined_at TEXT,
  owner_answers_ciphertext TEXT,
  invitee_answers_ciphertext TEXT,
  owner_completed_at TEXT,
  invitee_completed_at TEXT,
  report_ciphertext TEXT,
  report_status TEXT NOT NULL DEFAULT 'waiting' CHECK (report_status IN ('waiting', 'generating', 'ready', 'paused', 'insufficient')),
  generation_claim TEXT,
  generation_lease_until TEXT,
  CHECK (owner_account_id <> invitee_account_id),
  CHECK (joined_at IS NULL OR invitee_account_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS rooms_owner ON rooms(owner_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rooms_invitee ON rooms(invitee_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rooms_expiry ON rooms(expires_at);

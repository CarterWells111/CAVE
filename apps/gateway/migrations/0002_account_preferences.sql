CREATE TABLE IF NOT EXISTS account_preferences (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
  age_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (age_confirmed IN (0, 1)),
  address_preference TEXT CHECK (address_preference IN ('你', '妳')),
  updated_at TEXT,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0)
);

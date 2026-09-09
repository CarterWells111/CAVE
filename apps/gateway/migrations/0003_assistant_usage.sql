CREATE TABLE IF NOT EXISTS assistant_usage (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
  hour_start INTEGER NOT NULL,
  hour_used INTEGER NOT NULL CHECK (hour_used >= 0),
  day_start INTEGER NOT NULL,
  day_used INTEGER NOT NULL CHECK (day_used >= 0)
);

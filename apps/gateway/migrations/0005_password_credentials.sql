-- Existing accounts have no credential row and retain OTP access.
CREATE TABLE auth_password_credentials (
  account_id TEXT PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL
);

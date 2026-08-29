# Data classification and retention

内界 CAVE is local-first. Classification is a code and operations boundary, not a claim that all data has the same risk.

| Class | Data | Allowed locations | Retention and handling |
| --- | --- | --- | --- |
| Public | App name, reviewed course/lesson/scenario text, prompt/policy version identifiers, non-secret build version | Mobile bundle, Worker, GitHub, build service | Versioned with the application. Prompt and policy *text* is not public even when a version identifier is. |
| Local-operational | Pending local-data deletion marker | Device-only iOS SecureStore | Contains no正文 or identity data. Created before destructive deletion starts and cleared only after all local database files and secrets are removed. Its presence blocks authorization and causes startup to resume deletion. |
| Local-private | Course answers and progress, saved expression cards, privacy settings, chosen form of address, local 18+ declaration | iOS SQLCipher database; device-only iOS SecureStore for the declaration gate marker | Retained until per-record deletion or Delete All Data. A save is a distinct user action. No cloud sync. |
| Account-pseudonymous | Account UUID, keyed email lookup, OTP/session digests, expiry/attempt metadata, rate buckets, deletion grants and short-lived idempotency receipts | Gateway D1 only | No raw email or content. Challenges expire after 10 minutes; access sessions after 15 minutes; refresh sessions after 30 days; deletion grants after 5 minutes. Account deletion cascades account sessions/challenges/grants. Expired operational rows are eligible for scheduled cleanup. |
| Transient-identity | Normalized email address and one-time code during challenge delivery | Mobile memory, Worker memory, Resend delivery request | Used only to send a requested login or deletion code. Never written to D1, logs, analytics, errors, or support dumps. Resend handles the delivery request under its own service terms. |
| Transient-sensitive | Current raw transcript, request/response text, provider response body | Mobile memory; Worker/provider memory only while servicing one request | Current transcript is memory-only. Gateway stores no request or response正文 and sends no正文 to logs or metrics. It is persisted only when the user explicitly saves that individual practice and opts to include its transcript. |
| Secret | Model/provider credential, email/OTP HMAC keys, Resend credential, SQLCipher encryption key, random installation token, refresh token | Worker secret bindings; iOS SecureStore with device-only accessibility (key/token) | Access tokens are memory-only. Refresh tokens are stored only in device SecureStore and as one-way server digests. Never place secrets in the mobile bundle, GitHub, analytics, logs, errors, or support dumps. |
| Restricted implementation text | System prompt and safety policy text | Worker source/build artifact and approved repository readers | Not returned to the model user, copied to logs, or disclosed by model output. Version identifiers may be logged. |

## Persistence rules

- `PrivacySettings.defaultSaveTranscript` is permanently `false`; there is no “always save transcripts” mode.
- A normal practice turn creates no transcript row or default history. `saved_records.transcript` is nullable and is populated only by the current explicit save action.
- Gateway processing is stateless with respect to正文. Logs contain allowlisted metadata and character/token counts only.
- Installation tokens are random rate-limit pseudonyms, not account identifiers. The Worker hashes a token before using it as a rate key and never logs the raw value.
- Delete All Data records a pending marker before revoking the declaration, waits for database operations to quiesce, then deletes the database key, database/WAL/SHM files, installation token, email-auth session, and finally the marker. Startup resumes an interrupted deletion before authorization or storage initialization. It does not recreate storage until a later explicit adult confirmation. Repeating it is safe.
- Key/database mismatch is never silently repaired or deleted. Old-key/no-database, database/no-key, invalid-key, and SQLCipher mismatch states preserve the remaining artifacts and enter an explicit recovery-required state.
- Schema changes are forward-only entries in a contiguous migration registry. Each version advances atomically under an exclusive database transaction; a newer on-device schema fails closed when opened by an older bundle.
- Email login is optional and available only after the local 18+ declaration. The declaration remains self-attestation, not identity or age verification.
- Login creates no cloud journey record and grants no server access to local-private content. Device logout removes only the local session; cloud-account deletion and local-content deletion remain separate explicit actions.

## Data minimization review

New fields must be assigned a class, storage location, retention rule, deletion path, and log policy before implementation. Cloud sync, analytics profiles, and remote transcript storage remain out of scope.

# Data classification and retention

内界 CAVE is local-first. Classification is a code and operations boundary, not a claim that all data has the same risk.

| Class | Data | Allowed locations | Retention and handling |
| --- | --- | --- | --- |
| Public | App name, reviewed course/lesson/scenario text, prompt/policy version identifiers, non-secret build version | Mobile bundle, Worker, GitHub, build service | Versioned with the application. Prompt and policy *text* is not public even when a version identifier is. |
| Local-operational | Pending local-data deletion marker | Device-only iOS SecureStore | Contains no正文 or identity data. Created before destructive deletion starts and cleared only after all local database files and secrets are removed. Its presence blocks authorization and causes startup to resume deletion. |
| Local-private | Course answers and progress, saved expression cards, private-preparation checklist, communication-card fields and sharing confirmations, privacy settings, chosen form of address, local 18+ declaration | iOS SQLCipher database; device-only iOS SecureStore for the declaration gate marker | Retained until per-record deletion or Delete All Data. A save is a distinct user action. No cloud sync. A frozen `included && !needsReview` export snapshot may be deliberately copied to the system clipboard or saved to Photos after its own confirmation; iCloud behavior is controlled by device settings. |
| Transient-sensitive | Current raw transcript, request/response text, provider response body | Mobile memory; Worker/provider memory only while servicing one request | Current transcript is memory-only. Gateway stores no request or response正文 and sends no正文 to logs or metrics. It is persisted only when the user explicitly saves that individual practice and opts to include its transcript. |
| Secret | Model/provider credential, SQLCipher encryption key, random installation token | Worker secret binding (model credential); iOS SecureStore with device-only accessibility (key/token) | Never in the mobile bundle, GitHub, database, analytics, logs, errors, or support dumps. Delete All Data removes device secrets. Rotate provider credentials operationally. |
| Restricted implementation text | System prompt and safety policy text | Worker source/build artifact and approved repository readers | Not returned to the model user, copied to logs, or disclosed by model output. Version identifiers may be logged. |

## Persistence rules

- `PrivacySettings.defaultSaveTranscript` is permanently `false`; there is no “always save transcripts” mode.
- A normal practice turn creates no transcript row or default history. `saved_records.transcript` is nullable and is populated only by the current explicit save action.
- Gateway processing is stateless with respect to正文. Logs contain allowlisted metadata and character/token counts only.
- Installation tokens are random rate-limit pseudonyms, not account identifiers. The Worker hashes a token before using it as a rate key and never logs the raw value.
- Delete All Data records a pending marker before revoking the declaration, waits for database operations to quiesce, then deletes the database key, database/WAL/SHM files, installation token, and finally the marker. Startup resumes an interrupted deletion before authorization or storage initialization. It does not recreate storage until a later explicit adult confirmation. Repeating it is safe.
- Key/database mismatch is never silently repaired or deleted. Old-key/no-database, database/no-key, invalid-key, and SQLCipher mismatch states preserve the remaining artifacts and enter an explicit recovery-required state.
- Schema changes are forward-only entries in a contiguous migration registry. Each version advances atomically under an exclusive database transaction; a newer on-device schema fails closed when opened by an older bundle.
- The launch build has no account, email, OTP, device binding, or cloud journey record. The 18+ gate is a local user declaration, not identity or age verification.
- Communication-card export never includes pending, private, deleted, or review-required fields. Clipboard and Photos writes are each explicit, warned user actions; the Photos path uses iOS add-only `saveToLibraryAsync` and never reads the library. A legacy saved card must persist a current sharing-policy confirmation before those controls become available.

## Data minimization review

New fields must be assigned a class, storage location, retention rule, deletion path, and log policy before implementation. Account data, email authentication, cloud sync, analytics profiles, and remote transcript storage are out of scope for the launch build.

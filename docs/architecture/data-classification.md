# Data classification and retention

内界 CAVE is local-first. Classification is a code and operations boundary, not a claim that all data has the same risk.

| Class | Data | Allowed locations | Retention and handling |
| --- | --- | --- | --- |
| Public | App name, reviewed course/lesson/scenario text, prompt/policy version identifiers, non-secret build version | Mobile bundle, Worker, GitHub, build service | Versioned with the application. Prompt and policy *text* is not public even when a version identifier is. |
| Local-private | Course answers and progress, saved expression cards, privacy settings, chosen form of address, local 18+ declaration | iOS SQLCipher database; device-only iOS SecureStore for the declaration gate marker | Retained until per-record deletion or Delete All Data. A save is a distinct user action. No cloud sync. |
| Transient-sensitive | Current raw transcript, request/response text, provider response body | Mobile memory; Worker/provider memory only while servicing one request | Current transcript is memory-only. Gateway stores no request or response正文 and sends no正文 to logs or metrics. It is persisted only when the user explicitly saves that individual practice and opts to include its transcript. |
| Secret | Model/provider credential, SQLCipher encryption key, random installation token | Worker secret binding (model credential); iOS SecureStore with device-only accessibility (key/token) | Never in the mobile bundle, GitHub, database, analytics, logs, errors, or support dumps. Delete All Data removes device secrets. Rotate provider credentials operationally. |
| Restricted implementation text | System prompt and safety policy text | Worker source/build artifact and approved repository readers | Not returned to the model user, copied to logs, or disclosed by model output. Version identifiers may be logged. |

## Persistence rules

- `PrivacySettings.defaultSaveTranscript` is permanently `false`; there is no “always save transcripts” mode.
- A normal practice turn creates no transcript row or default history. `saved_records.transcript` is nullable and is populated only by the current explicit save action.
- Gateway processing is stateless with respect to正文. Logs contain allowlisted metadata and character/token counts only.
- Installation tokens are random rate-limit pseudonyms, not account identifiers. The Worker hashes a token before using it as a rate key and never logs the raw value.
- Delete All Data closes the database, removes database/WAL/SHM files, and deletes the database key, installation token, and declaration marker. It does not recreate storage until a later explicit adult confirmation. Repeating it is safe.
- Key/database mismatch is not partially recovered: old-key/no-database and database/no-key states are cleared and regenerated.
- The launch build has no account, email, OTP, device binding, or cloud journey record. The 18+ gate is a local user declaration, not identity or age verification.

## Data minimization review

New fields must be assigned a class, storage location, retention rule, deletion path, and log policy before implementation. Account data, email authentication, cloud sync, analytics profiles, and remote transcript storage are out of scope for the launch build.

# Email authentication operations

This runbook describes local and production setup for the optional email-code account service. Repository changes do not provision, migrate, deploy, or send email by themselves.

## Fixed behavior

- Sender: `内界 CAVE <support@neijiecave.com>` through Resend; Zoho continues to receive replies for the same address.
- Sign-in and deletion codes: six digits, 10-minute lifetime, five attempts.
- Delivery limits: three challenges per keyed email and five per installation in each 15-minute fixed window.
- Access token: opaque, 15 minutes, memory-only on mobile.
- Refresh token: opaque, 30 days, device-only SecureStore, digest-only in D1, and conditionally rotated. Mobile refreshes are single-flight. A previous token never rotates the session again; the 30-second record is used only to distinguish a likely duplicate from delayed replay before revocation and for best-effort logout.
- Account deletion: live access token + matching email + fresh OTP + one-use five-minute grant; deletion retries use a keyed 24-hour receipt.
- D1 never stores a raw email, raw OTP, raw access/refresh/deletion token, or local-private content.

## Local setup

1. Copy `.env.example` values into the local secret mechanism. Generate independent values of at least 32 random bytes for `AUTH_EMAIL_LOOKUP_KEY_V1` and `AUTH_OTP_KEY_V1`; the Worker rejects short, duplicate, or cross-purpose-reused keys. Never reuse the model or Resend key.
2. For real delivery, set `RESEND_API_KEY`. Tests use an injected sender and do not contact Resend.
3. Apply `apps/gateway/migrations/0001_auth.sql` to the local `AUTH_DB` D1 database before exercising routes.
4. Run gateway contracts, tests, typecheck, lint, and dry-run build. Run mobile auth tests plus the full mobile suite.

## Production activation checklist

1. Verify `neijiecave.com` in Resend and confirm SPF/DKIM/DMARC alignment without replacing the Zoho MX records. This is a human/operations step.
2. Create the production D1 database named in `wrangler.jsonc`, then add its real `database_id` locally before deployment.
3. Apply D1 migrations explicitly and verify all seven auth tables and foreign keys before enabling traffic.
4. Add `RESEND_API_KEY`, `AUTH_EMAIL_LOOKUP_KEY_V1`, and `AUTH_OTP_KEY_V1` as Worker secrets. Never put them under `vars` or an `EXPO_PUBLIC_` name.
5. Set the mobile build's `EXPO_PUBLIC_GATEWAY_URL` to the reviewed HTTPS gateway origin. It is a public URL, not a secret.
6. Send canary login and deletion codes to controlled mailboxes; inspect only allowlisted route/status/request-id logs and confirm no email, code, token, or provider response body appears.
7. Verify challenge throttling, wrong-code lockout, offline mobile behavior, refresh rotation, logout, deletion retry, and the separation between account deletion and local-data deletion.

## Key rotation and failure handling

- To rotate, add `AUTH_EMAIL_LOOKUP_KEY_V2` and/or `AUTH_OTP_KEY_V2` as independent Worker secrets while retaining V1. The Worker uses V2 for new records, checks all retained email lookup versions during sign-in, invalidates outstanding sign-in challenges across those versions, and migrates an existing account to the current lookup only after successful OTP verification. Stored challenge key versions keep other in-flight OTPs verifiable. Pause challenge issuance during the secret rollout (or wait for the 10-minute challenge lifetime before resuming) so an old Worker instance cannot issue a V1-only challenge after V2 traffic starts. Remove V1 only after all accounts have signed in and migrated and all V1 challenges have expired; a later V3 rotation requires adding the next binding and retained ring in code first.
- If Resend is unavailable, invalidate the just-created challenge and return a generic 503. Do not claim delivery.
- If D1 or required secrets are missing, authentication fails closed with 503 while health, public content, and local mobile features remain available.
- A 401 on refresh clears the local session. A network failure keeps the refresh token and displays offline status.
- Roll back application code without rolling back the append-only D1 migration. Authentication routes may be disabled, but local-private content is unaffected.

## Data cleanup

Expired challenges, sessions, rate buckets, deletion grants, and deletion receipts are operational metadata. The Worker cron runs daily at 03:17 UTC and processes up to 20 batches of 500 expired rows per table, stopping early when no table fills a batch and emitting only an allowlisted backlog event if the bound is reached. Suppression rows remain until an explicit deliverability review removes them. Monitor counts only; do not log row bodies or keyed identifiers.

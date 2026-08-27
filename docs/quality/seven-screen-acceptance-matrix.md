# Seven-screen acceptance evidence

Updated: 2026-08-27

## Baseline and synchronization

- Authoritative product baseline: `origin/main@ccb188bd97b3b60c68505021efefd66a0b6e271f`.
- Verified ancestors: Plan 05C merge `ca875094`; Plan 05D merge `8e4ce3b`.
- Non-destructive synchronization commit: `666b21d`.
- Conflict resolution: no code conflict; the incoming product blueprint and assets were accepted without overwriting the preserved Plan 06 foundation commits.

## First-run seven-screen evidence

Status: `local_automated_pass`

- Exactly seven canonical routes are active. The old behavior, checklist, and communication-card paths are compatibility redirects only.
- Screen 1 has no numeric progress. Screens 2–7 use a seven-screen total.
- The former checklist and card screens are one final preparation screen. The unreferenced eight-screen UI and its pause-card implementation were removed.
- Draft schema v2 and additive database schema v3 migration tests cover transactional import, receipt idempotence, rollback, legacy recovery, and private legacy card handling.
- Address preference, explicit-content consent, complete reflection/journal values, preset-practice results, private preparation, and card visibility use typed application commands and repository persistence.
- Preview, clipboard, image-export input, and completion all use `selectConfirmedCommunicationCard()`. Only explicitly included sections are emitted.
- The local image-export adapter captures the warm-paper preview, requests write-only photo permission only after explicit confirmation, saves through Expo Media Library, and offers a user-triggered system-settings recovery after permanent denial.
- Additive database schema v4 stores a first-run completion marker separately from the active draft. Card persistence must succeed before the marker is written, and the first marker cannot be overwritten by later reviews.

## Accessibility and resilient-state evidence

Status: `local_automated_pass`

- Semantic dark and warm-paper tokens have automated WCAG AA contrast coverage.
- Core actions and choices have at least 44 by 44 point targets, visible non-color state markers, roles, checked/selected/busy/disabled state, and focus styling.
- Layout contracts cover safe areas, keyboard avoidance, flexible multiline input, reduced motion, narrow widths, and large text without fixed text heights.
- Medical illustration review includes text alternatives, explicit persisted consent, failure recovery, and labelled 100–200% button-controlled zoom.
- Async actions cover duplicate presses, unmount/stale-result protection, queued-write flush, failed-write retry, and successful-completion lockout.
- Sensitive copy, repository payloads, and adapter failures are excluded from logs and user-visible diagnostic detail by tests.

## Verification run

Status: `local_automated_pass`

- Workspace typecheck: passed.
- Workspace lint: passed.
- Workspace tests: passed. Mobile: 68 suites / 472 tests. Other packages: contracts 19, content 39, scenario engine 18, gateway 160, test fixtures 11.
- Content tests: 4 files / 39 tests passed.
- Draft content validation: passed.
- Safety regression: 4 files / 53 tests passed.
- Expo Doctor: 18/18 checks passed after allowing its required Expo API access.
- Android Expo export: passed; 1 Hermes bundle and 25 assets exported, including the checked-in 309 kB medical illustration through the monorepo Metro boundary.
- Bundle secret scan: passed across 27 exported files.
- Forbidden runtime scan: no network, AI provider, microphone/recording, or automatic permission-request imports found in mobile application source.
- `git diff --check`: passed.

## Honest pending evidence

- `expo_go_memory_visual_pending`: the Android bundle exports successfully, but this checkpoint does not claim a human-observed Expo Go walkthrough or screenshot review.
- `content_expert_review_pending`: the repository contains verified source metadata, while the catalog copy and medical illustration remain draft or `expert_review_pending` according to their checked-in records.
- `production_content_validation_pending`: production validation correctly fails with the checked-in draft and expert-pending entries. No reviewer, `reviewedAt`, or approval was invented.
- `device_external_pending`: physical iPhone cold start, VoiceOver, system keyboard/Dynamic Type settings, SQLCipher migration/persistence, SecureStore/Keychain, photo-library save and permission recovery, system share, external links/telephone behavior, and Apple signing were not executed by this local run.

These pending gates do not invalidate local product implementation, but they must not be reported as release evidence.

## Long-term app shell checkpoint

Status: `local_automated_pass`

- The first-run completion marker, rather than the presence of an active draft, selects the cold-start route.
- First-run users remain in the full-screen seven-screen journey. Completed users receive exactly four destinations: Home, Reviews, Practice, and Cards.
- A later incomplete review does not take over cold start or lock the other destinations. The four-destination navigation remains available while a later full review is open.
- Starting a replacement full review requires an explicit confirmation when an active later draft exists.
- Standalone topic reflection and deterministic practice routes do not depend on seven-screen route prerequisites; practice remains labelled as preset, local, non-AI, and non-recording.
- Home and list screens load only neutral card metadata. Sensitive card payload is loaded only after an explicit card selection.
- Saved-card detail, copy, local edit, and full-screen presentation use only explicitly included sections; private and deleted fields are not accepted by the detail component.
- Settings stays outside the tab bar. Delete-all has explicit confirmation, safe failure UI, no optimistic success, and refreshes the shared runtime snapshot after success.
- Focused shell and repository tests passed, followed by mobile typecheck, lint, and 82 suites / 525 tests.

The shell checkpoint remains stacked on the first-run PR. Immutable review versions, explicit later-review completion lifecycle, branching, and transactional history deletion are owned by the following version-history checkpoint, not claimed here.

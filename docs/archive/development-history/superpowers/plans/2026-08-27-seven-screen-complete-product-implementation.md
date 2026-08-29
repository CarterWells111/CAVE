# CAVE Seven-Screen Complete Product Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` for disjoint tasks, `superpowers:test-driven-development` for every behavior change, `building-native-ui` for Expo UI implementation, and `superpowers:verification-before-completion` before every phase commit and PR.

**Goal:** Deliver a locally functional CAVE app whose first-use experience implements the approved seven-screen blueprint, then unlocks a four-tab long-term shell with versioned local reviews and private history.

**Architecture:** Preserve the verified design primitives, async guards, responsive layout, and accessibility contracts already implemented on `codex/plan-06-product-ux`, but replace the obsolete eight-page route model and light visual theme with the seven-screen specification merged at `origin/main@ccb188bd97b3b60c68505021efefd66a0b6e271f`. Keep first-run routes outside tabs, persist completion separately from an active review, and add history through additive SQLCipher schema migrations behind repositories that expose metadata separately from sensitive payloads.

**Tech Stack:** Expo SDK 54, Expo Router 6, React Native 0.81, TypeScript strict, Jest, React Native Testing Library, Expo Clipboard/FileSystem/MediaLibrary, `react-native-view-shot`, Expo SQLite with SQLCipher in native builds, SecureStore, workspace content/catalog packages.

---

## 1. Authority, baseline, and locked decisions

### 1.1 Source of truth

Implementation priority is:

1. Direct user decisions in the active task, including the long-term four-tab product direction.
2. `docs/design/2026-08-27-seven-screen-ui-renovation-blueprint.md`.
3. `docs/product/2026-08-27-seven-screen-product-spec.md`.
4. `docs/content/source-registry.md` and `docs/content/mvp-content-review-request.md`.
5. Existing code and historical Plan 05/06 documents only where they do not conflict.

`origin/main@ccb188b` explicitly marks the old eight-screen roadmap as historical. The final implementation must contain seven numbered screens, no `/ 8` UI, and no independent checklist and communication-card screens.

### 1.2 Current branch checkpoint

- Branch: `codex/plan-06-product-ux`.
- Latest committed checkpoint: `d0e00ba2f06d2eeb5df802e144abc88235ffe519`.
- Verified reusable commits include:
  - `9c2aa7f` — semantic primitives and accessibility contracts;
  - `17e0fde` — non-destructive sync of Plan 05D merge `8e4ce3b`, with no conflicts;
  - `d0e00ba` — responsive controls, async route guards, promise-safe journey actions, and eight-screen visual adoption.
- Uncommitted safe checkpoint:
  - `JourneyProvider.tsx/test` has a complete GREEN recovery-state implementation;
  - `JourneyPages.test.tsx` contains five unverified tests written for the obsolete Page 7/8 split and must be translated into seven-screen Page 7 tests before any commit.

No current commit is discarded or history-rewritten. The branch will merge the exact `ccb188b` main commit after the user approves this plan.

### 1.3 Product outcome

- First use: full-screen seven-screen flow, without bottom tabs.
- Screen 1 contains adult confirmation, pronoun/address preference, and the optional preface as sub-states; it does not show progress.
- Screens 2–7 show `n / 7`; Page 7 combines private preparation, partner-visible communication draft, local save, image export, copy, and echo results.
- Completing Page 7 persists a completion marker and opens the long-term home.
- Later launches open Home. An unfinished new review never disables the four long-term tabs.
- Long-term tabs are exactly Home, Reviews, Practice, and Cards. Settings/privacy/delete-all are reached from the Home header, not a fifth tab.
- No AI, account, network sync, store, community, readiness score, auto-share, auto-dial, or enabled cloud action is added.

### 1.4 Evidence policy

- New blueprint copy and the medical asset may be implemented and tested locally while their review state remains visible and machine-readable.
- `docs/content/source-registry.md` currently says `source_verified; expert_review_pending`; it does not prove expert approval.
- The medical PNG remains `expert_review_pending`; local/demo UI labels it as a review asset and provides equivalent alt text.
- Production content validation is reported as expected failure until real review metadata exists. No `reviewedAt` is invented.
- Expo Go proves only in-session memory behavior and local visuals. Real cold-start persistence, SQLCipher, SecureStore, VoiceOver, signing, and physical-iPhone evidence remain `external_pending` until run.

---

## 2. Recommended delivery and PR chain

### Chosen approach: compatibility migration with stacked delivery

Keep the current branch and verified commits, merge `origin/main@ccb188b`, and migrate the final state to seven screens. This retains proven async/a11y behavior while avoiding a second implementation of the same primitives.

Alternatives rejected:

- Restart from `origin/main`: clean history, but discards verified 06A/06B behavior and repeats high-risk async/a11y work.
- Keep eight routes and only relabel progress: fast, but directly violates the seven-screen source of truth and keeps two final screens.
- Merge long-term shell into the same first PR: fewer PRs, but creates an unreviewable UI/domain/storage change set and blocks isolated rollback.

PR chain:

1. `codex/plan-06-product-ux` → `main`: seven-screen first-use product, complete styles/interactions, content/source/medical integration, and state/a11y closure.
2. `codex/plan-06d-long-term-app-shell` → Plan 06 head: four-tab long-term mode and completion/launch guards.
3. `codex/plan-06e-versioned-history` → Plan 06D head: immutable versions, branching, private history, and deletion recovery.

All PRs may be opened automatically after verification, but none may merge `main` without a new explicit user instruction. If an upstream PR merges while a stack is active, fetch, prove the merge ancestor, non-destructively sync, rerun all gates, and retarget without force-push.

---

## 3. File and ownership map

### 3.1 Reusable core to modify

- `apps/mobile/src/core/design/{tokens,theme,motion}.ts`
- `apps/mobile/src/core/ui/{Screen,Card,Button,ChoiceChip,ProgressHeader,StatusBanner,EmptyState,ErrorState}.tsx`
- Create `apps/mobile/src/core/ui/{SecondaryButton,TextAction,InfoCard,StickyActionBar,BottomSheet,SourceDrawer,EchoBackground}.tsx`
- Matching focused tests for every file.
- Modify `apps/mobile/package.json`, `pnpm-lock.yaml`, and `apps/mobile/app.config.ts` only for Expo-compatible image export dependencies and explicit photo-library permission copy.

Responsibilities:

- Core owns dark semantic styling, input-independent interaction states, responsive layout, focus, and reduced motion.
- Core never imports journey domain, content catalogs, repositories, routes, or raw SQL.

### 3.2 Seven-screen domain and application

- Modify `apps/mobile/src/features/journey/domain/{types,commands,reducer}.ts`.
- Modify `derive-checklist.ts` into private-preparation derivation while retaining deterministic stable IDs.
- Modify `derive-communication-card.ts` to produce seven user-confirmable sections and preserve user text with `needsReview`.
- Extend `practice-types.ts` and `preset-practice-engine.ts` for the approved fixed state machine.
- Modify `application/{journey-navigation,journey-application-service,page-controllers,points-ledger}.ts`.
- Add `domain/migrate-journey-draft.ts` and focused tests.

### 3.3 Content and sources

- Modify `packages/content/src/{catalog,load,validate}.ts` and tests.
- Replace placeholder source data in `packages/content/data/journey-sources.json` with SRC-001–SRC-013 metadata from the registry.
- Expand `journey-options.json`, `journey-knowledge.json`, and `journey-practice.json` from the approved seven-screen copy.
- Create `packages/content/data/journey-ui-copy.json` for stable MED/EDU/UX/REVIEW copy IDs.
- All adapted text remains draft/expert-pending unless the repository contains real reviewer/date/version evidence.

### 3.4 Seven-screen UI

- Split the current monolithic `JourneyPages.tsx` into:
  - `ui/pages/WelcomePage.tsx`
  - `ui/pages/OvernightPage.tsx`
  - `ui/pages/BodyKnowledgePage.tsx`
  - `ui/pages/BehaviorMapPage.tsx`
  - `ui/pages/ReflectionPage.tsx`
  - `ui/pages/PresetPracticePage.tsx`
  - `ui/pages/FinalPreparationPage.tsx`
- Create feature components:
  - `ui/components/BehaviorMap.tsx`
  - `ui/components/MedicalDiagram.tsx`
  - `ui/components/EditablePhraseCard.tsx`
  - `ui/components/JournalField.tsx`
  - `ui/components/EchoReward.tsx`
  - `ui/components/PrivatePreparation.tsx`
  - `ui/components/CommunicationDraft.tsx`
  - `ui/components/SharePreview.tsx`
- Keep thin route adapters in `apps/mobile/app/journey/**`.

Each page/component owns only presentation state and delegates persisted mutations to controllers. Sensitive text never enters logs, route params, list summaries, test snapshots, or analytics.

### 3.5 Long-term shell and history

- Create `apps/mobile/app/(tabs)/_layout.tsx` and Home/Reviews/Practice/Cards routes.
- Create `apps/mobile/app/settings/**` routes outside tabs.
- Create `features/shell/**` for launch/completion state and route guards.
- Create `features/reviews/**` for metadata lists, detail, fork, and delete flows.
- Add SQL schema v3 for seven-screen draft payloads, v4 for app-shell completion state, and v5 for versioned review history.

---

## 4. Phase 0 — Freeze checkpoint and synchronize the new authority

**Commit:** `docs: adopt the seven-screen product execution plan`

- [ ] Verify `git status --short` contains only the known Provider and Page test checkpoint plus this plan.
- [ ] Run the Provider focused suite and confirm 16/16 GREEN.
- [ ] Run the five newly added Page tests once and record their actual RED failures; do not commit them as passing work.
- [ ] Selectively commit only the GREEN Provider recovery changes as `fix(mobile): harden journey provider recovery states`.
- [ ] Keep the Page test diff uncommitted and translate its intent during Phase 5; do not silently discard it.
- [ ] Fresh-fetch `origin`, record the exact `origin/main` SHA, and stop for plan revalidation if it is no longer `ccb188bd97b3b60c68505021efefd66a0b6e271f`.
- [ ] Prove `origin/main` contains Plan 05C and 05D with `git merge-base --is-ancestor ca875094 origin/main` and `git merge-base --is-ancestor 8e4ce3b origin/main`; both must exit 0.
- [ ] Compare `git diff --name-only HEAD...origin/main` with `git diff --name-only`; the fetched PR #11 set must not overlap the Provider/Page checkpoint. If it does, preserve both sides and resolve explicitly before continuing.
- [ ] Merge exact `origin/main@ccb188b` with a non-destructive merge commit and record conflicts. Expected conflict set is documentation-only or empty because PR #11 adds docs/assets.
- [ ] Confirm the medical asset blob exists and old v1–v5 assets are not referenced.
- [ ] Mark `2026-08-27-06a-06c-product-ux-execution.md` as a historical checkpoint superseded by this plan.
- [ ] Run baseline mobile tests, typecheck, lint, draft content validation, safety tests, and `git diff --check`.

Stop if fetched `origin/main` advances beyond `ccb188b`; inspect the new commits and update this plan before merging.

---

## 5. Phase 1 — Seven-screen contracts, migration, and navigation

**Commit:** `feat(mobile): migrate the journey to seven screens`

### Task 1.1: Lock the seven-screen route contract

- [ ] RED: update `journey-navigation.test.ts` to require:

```ts
export const JOURNEY_PAGE_IDS = [
  "welcome",
  "overnight",
  "body-knowledge",
  "behavior-map",
  "reflection",
  "preset-practice",
  "final-preparation"
] as const;
```

- [ ] RED: assert Screen 1 has no progress and Screens 2–7 expose `n / 7`.
- [ ] RED: assert legacy draft pages map deterministically: `behavior-attitudes → behavior-map`, `checklist → final-preparation`, and `communication-card → final-preparation`.
- [ ] RED: assert every route has forward/back/resume behavior and no route can produce `/ 8`.
- [ ] Run focused tests and capture expected failures against the eight-page manifest.

### Task 1.2: Introduce draft schema v2 and database schema v3 without losing v1 data

- [ ] RED: add fixtures for all v1 current pages and fields, including user-edited communication-card text.
- [ ] RED: assert migration preserves age, selections, journal choice, edited phrase, checklist state, card overrides, point event keys, and timestamps.
- [ ] RED: assert old Page 7/8 data becomes one Page 7 private/share model without marking any segment shared by default.
- [ ] RED: unknown migrated address preference remains `null` and reopens the address BottomSheet at the next safe entry; never guess `你` or `妳`.
- [ ] Implement `migrateJourneyDraftV1ToV2()` as a pure function. Never mutate the persisted input.
- [ ] Add database user_version 3 with a v2 journey-draft table and migration-receipt table because the current v2 table has `CHECK (schema_version = 1)` and cannot safely store v2 payloads.
- [ ] In one transaction, read v1, copy, validate, write v2, and record the receipt. Switch the active repository snapshot only after commit.
- [ ] RED: migration failure rolls back every v3 write, repeated startup is idempotent, partially malformed v1 remains recoverable, and v1 data remains readable for a forward fix.
- [ ] Never downgrade a device that has reached database schema v3; rollback keeps the v3 reader/migration and disables only new routing.

### Task 1.3: Replace route adapters

- [ ] Create `behavior-map.tsx` and `final-preparation.tsx` route adapters.
- [ ] Update Page 4, 6, and 7 controller wiring to the new IDs.
- [ ] Remove obsolete Page 7→Page 8 navigation only after the seven-screen production-flow integration test is GREEN.
- [ ] Delete obsolete route modules/tests after all references are gone; `rg 'checklist|communication-card|/ 8' apps/mobile/app apps/mobile/src/features/journey` must return only migration/history terminology, not active route IDs.
- [ ] Run navigation, repository, reducer, controller, and production-flow suites.

### Phase 1 verification

- [ ] Independent spec review against the two seven-screen documents.
- [ ] Independent quality review of the migration and route guards.
- [ ] Typecheck, lint, all mobile tests, draft validation, safety regression, forbidden route/import scan, and diff-check.

---

## 6. Phase 2 — Dark design system and blueprint components

**Commit:** `feat(mobile): build the seven-screen visual system`

### Task 2.1: Replace the light theme with semantic dark and paper themes

- [ ] RED: assert every color token from blueprint section 2.3 exactly once, including `canvas.base`, `canvas.soft`, `surface.*`, `brand.*`, `paper.*`, disabled, focus, info, and safety roles.
- [ ] RED: calculate WCAG contrast for every text/background and interactive boundary pairing; main body must reach 4.5:1 and large/non-text targets 3:1.
- [ ] RED: assert typography, spacing `4,8,12,16,20,24,32,40,48`, radii, 52-point primary actions, 44-point minimum controls, 600-point readable width, and 200% text-safe line heights.
- [ ] Implement `darkTheme` plus a separate `paperTheme`; do not scatter raw hex values in page files.
- [ ] Use system serif/sans fallbacks until licensed font assets are present; never block text while loading a custom font.

### Task 2.2: Parameterize and extend primitives

- [ ] RED: `ProgressHeader` accepts `totalPages` and compact `n / total` formatting, supports no-progress Screen 1, and wraps on 360pt/200% text.
- [ ] RED: primary/secondary/text actions cover default, pressed, disabled, loading, focus, and 44/52-point targets.
- [ ] RED: `InfoCard` exposes ordinary, medical, education, pause, and safety variants with visible labels and non-color semantics.
- [ ] RED: `BottomSheet`/`SourceDrawer` trap focus while open, restore focus on close, respect keyboard/safe area, and scroll below 78% viewport height.
- [ ] RED: `StickyActionBar` never covers content and adds safe bottom padding.
- [ ] RED: `EchoBackground` is accessibility-hidden and entirely static under reduced motion.
- [ ] Implement with React Native primitives and built-in `Animated`; do not add decorative semantics or celebratory motion.

### Task 2.3: Responsive and reduced-motion matrix

- [ ] Test 390×844, 360×780, 320pt defensive width, fontScale 1/1.5/2, keyboard shown, and reduced motion.
- [ ] Assert no fixed text height, no `numberOfLines` on required copy, no horizontal body scroll, and no nested vertical `ScrollView`.
- [ ] Verify focus rings and state markers do not depend on color.

---

## 7. Phase 3 — Content, sources, and medical asset pipeline

**Commit:** `feat(content): register the seven-screen draft catalog`

### Task 3.1: Machine-readable seven-screen content

- [ ] RED: schema tests require stable copy IDs, page ownership, content type (`MED|EDU|UX|REVIEW`), source IDs, review status, and optional real `reviewedAt` only for reviewed entries.
- [ ] Model source verification separately from expert copy review: `source_verified` may coexist with `expert_review_pending` and never satisfies the production copy gate.
- [ ] RED: every MED/EDU item references known SRC IDs; UX copy may have no source and must not pretend to be medical advice.
- [ ] RED: all nine behavior-map points, five equal-weight answers, six practice intents, partner branches, safety numbers, and seven communication sections are present.
- [ ] Populate the catalog from the approved spec while keeping `reviewStatus: "draft"`/expert pending.
- [ ] Replace invalid example source URLs with the registry's real metadata.

### Task 3.2: Medical image contract

- [ ] RED: assert the only allowed asset is `assets/medical/vulva-anatomy-review-current.png`; no v1–v5 reference exists.
- [ ] RED: assert contain-mode rendering, aspect-ratio preservation, accessible zoom controls, review badge, and alt text naming all eight required structures.
- [ ] Implement a cross-platform accessible zoom modal with explicit zoom-in/out/reset controls; pinch gestures are optional, not the only control.
- [ ] Keep image and Chinese medical copy visibly `医学图审核稿` in local/demo builds until expert evidence lands.

### Task 3.3: Honest validation

- [ ] `validate:content:draft` must pass.
- [ ] Production validation must fail only for genuine pending review, not schema/source/link errors.
- [ ] Record `expert_review_pending`, never `reviewed`, unless reviewer, role, date, version, and conclusion are committed.

---

## 8. Phase 4 — Screens 1–3

**Commit:** `feat(mobile): implement the first three seven-screen experiences`

### Screen 1

- [ ] RED states: initial, underage overlay, adult-confirmed address sheet unselected/selected, preface shown/skipped, reduced motion, resume existing draft.
- [ ] Implement abstract echo background, canonical brand, adult branch, `你/妳` local preference, and optional preface without page progress.
- [ ] Do not add identity upload, shame, countdown, or a bottom tab.

### Screen 2

- [ ] RED states: expectation empty/multi/exclusive, concern empty/multi/exclusive, stage transition, focus move, edit summary, restore last stage/scroll position.
- [ ] Implement equal-weight expectation/concern visuals, no selection count, no analysis, and direct continuation.

### Screen 3

- [ ] RED states: all three knowledge cards visible, diagram closed/open, source drawer, zoom, equivalent text, review status, continue without diagram, one-time echo.
- [ ] Integrate SRC records and medical asset without claiming expert approval.

### Phase 4 verification

- [ ] Screen-reader order, 44×44, small screen, 200% text, reduced motion, keyboard, back preservation, and no raw content IDs.
- [ ] Page-focused tests plus production navigation through Screen 3.

---

## 9. Phase 5 — Screens 4–5 and translated 06C state tests

**Commit:** `feat(mobile): implement behavior mapping and reflection`

### Screen 4 behavior map

- [ ] RED: nine equal points, accessible position labels, current point centered, five equal answers, no auto-advance, back edit, more-content skip/confirm/back, two explicit sensitive behavior cards, custom empty/value paths.
- [ ] RED: content confirmation never changes real-world consent and skipping never changes points.
- [ ] Implement cross-fade only; reduced motion uses at most 120ms opacity and no translation.
- [ ] Never auto-select a behavior for practice or card sharing.

### Screen 5 reflection

- [ ] RED: fixed-order non-ranked answer groups, inline edit, motivation exclusive skip, disappointment branch, ability-to-refuse branch, expression states, comfort states, journal empty/save/skip, storage sheet, cloud disabled.
- [ ] RED: saved/error/retry states announce safely; private text is never logged or used for points.
- [ ] Implement deterministic derived updates and direct Page 4 edit without restarting the map.
- [ ] Translate the five paused `JourneyPages.test.tsx` intentions into the new Page 7/Page 6 owners; delete obsolete eight-page assertions only after equivalent seven-screen tests are RED then GREEN.

### Phase 5 verification

- [ ] Verify no readiness, percentage, ranking, completion ticks, or sensitive-value reward logic.
- [ ] Verify local save copy accurately distinguishes Expo Go memory-only from native SQLCipher capability.

---

## 10. Phase 6 — Screen 6 preset practice state machine

**Commit:** `feat(mobile): complete the preset boundary practice`

- [ ] RED: persistent `预设对话，不使用 AI` label and absence of generated/typing language.
- [ ] RED: behavior selection never suggests a `not-this-time` item; sensitive “more” items require a fresh active choice.
- [ ] RED: six needs map to six editable phrases; no automatic apology is introduced.
- [ ] RED: mirror practice requests no microphone permission, records no audio, and relies on explicit user confirmation.
- [ ] RED: respectful response stops/adjusts first; optional disappointed/pressure branches are skippable and add no points.
- [ ] RED: continued pressure terminates ordinary practice and exposes mainland-China support information with copy-only actions, no auto-dial.
- [ ] RED: support numbers and source links are conditional knowledge, not a claim that the user is currently in danger.
- [ ] RED: completion summary, shorter phrase, add-to-preparation, repeat practice, and one-time echo.
- [ ] Extend the local preset engine and controller; do not add a gateway, model, network request, or prompt.

---

## 11. Phase 7 — Combined Screen 7, export, and first-run completion

**Commit:** `feat(mobile): complete private preparation and communication sharing`

### Task 7.1: Private preparation

- [ ] RED: private section shows only useful derived groups, three equal states, conditional health preparation, aftercare, and no gate/count/score.
- [ ] RED: removing an item from preparation does not delete journal/history data.
- [ ] RED: upstream changes deterministically rebuild generated text while retaining user text and setting `needsReview`.

### Task 7.2: Partner-visible draft

- [ ] RED: all seven sections start `待你确认` and are excluded from share output until explicitly included.
- [ ] Use an explicit visibility state such as `pending | included | private | deleted`; no boolean default may accidentally share a segment.
- [ ] RED: journal text, motivations, pressure branch, and non-ideal practice are never included by default.
- [ ] RED: include/edit/private/delete actions are explicit, recoverable, and preserve a fixed consent footer.
- [ ] RED: preview, PNG, and clipboard output use one `selectConfirmedCommunicationCard()` result and cannot build independent payloads.
- [ ] Flush all queued field edits through one coordinator before preview, copy, image export, save, or finish.

### Task 7.3: Save image and copy

- [ ] Install Expo-compatible versions with `corepack pnpm --filter @cave/mobile exec expo install expo-media-library react-native-view-shot`; inspect the package and lockfile diff before continuing.
- [ ] Configure the iOS photo-library add-only permission text and Android media permission behavior in `apps/mobile/app.config.ts`; do not request permission at app startup.
- [ ] RED: image export asks permission only after explicit action, previews first, writes PNG to the photo library, explains possible system cloud-photo sync, and recovers from denial/write failure.
- [ ] RED: copy explains the system clipboard, never auto-sends, and exposes pending/success/error/retry.
- [ ] RED: handwriting advice creates no PDF/template/product.

### Task 7.4: Completion transaction

- [ ] RED: Page 7 cannot mark first-run complete until current draft and confirmed card save successfully.
- [ ] RED: failure leaves the user on Page 7 with data intact and a retry action.
- [ ] RED: success emits one completion event and routes to the long-term handoff target when Phase 8 is present; before then it shows a non-dead-end local completion view.

### Phase 7 verification and first PR

- [ ] Full seven-screen production integration with back/edit/retry paths and no dead end.
- [ ] Visual matrix for every state listed in blueprint section 14.
- [ ] Independent spec and quality review.
- [ ] Full repository gates from section 14 below.
- [ ] Push/update `codex/plan-06-product-ux` and open the seven-screen PR; do not merge.

---

## 12. Phase 8 — Long-term four-tab app shell (stacked PR 2)

**Branch:** `codex/plan-06d-long-term-app-shell`

**Commits:**

1. `feat(mobile): persist long-term shell state`
2. `feat(mobile): guard first-run and long-term routes`
3. `feat(mobile): add the four-tab app shell`
4. `feat(mobile): add local home review and practice hubs`
5. `feat(mobile): add private communication card history`
6. `feat(mobile): add local privacy and deletion controls`
7. `test(mobile): verify the accessible long-term shell`

### Task 8.1: Additive SQL schema v4

- [ ] RED migration tests for a singleton `app_shell_state(initial_journey_completed_at, initial_journey_id)`.
- [ ] Preserve schema v1/v2/v3 tables and receipts; never downgrade after v4 is published.
- [ ] Repository exposes completion state without exposing journey payload.

### Task 8.2: Launch and route guards

- [ ] RED: no marker → full-screen welcome with no tabs.
- [ ] RED: marker → Home on cold start, even if a later review is unfinished.
- [ ] RED: deep links to tabs/settings before first completion return to welcome.
- [ ] RED: delete-all success clears marker and returns to welcome; failure retains state and offers retry.

### Task 8.3: Four tabs and Home

- [ ] Create exactly Home, Reviews, Practice, Cards tabs with accessible labels and 44×44 targets.
- [ ] Home contains continue unfinished review, current card, start practice, start review, and recent metadata.
- [ ] Home/history never display sensitive body copy; only user-selected title, date, and status.
- [ ] Settings/privacy/delete-all are in the Home header, not a fifth tab.

### Task 8.4: Direct and full reviews

- [ ] Reviews supports topic entry plus a user-initiated full seven-screen review.
- [ ] Exiting a later full review returns Home without deleting its draft.
- [ ] An active draft adds `继续本次回顾` but does not disable other tabs.

### Task 8.5: Practice and Cards

- [ ] Practice reuses the local preset engine and always displays non-AI disclosure.
- [ ] Cards shows current card plus local versions, edit/save/copy/full-screen actions, and disabled cloud.
- [ ] Empty/loading/error/retry states are real destinations, never blank tab roots.

Open stacked PR 2 against the seven-screen branch head. Do not merge.

---

## 13. Phase 9 — Versioned reviews and private history (stacked PR 3)

**Branch:** `codex/plan-06e-versioned-history`

**Commits:**

1. `feat(mobile): define versioned local reviews`
2. `feat(mobile): persist encrypted review history`
3. `feat(mobile): enforce one active local review`
4. `feat(mobile): branch reviews with deterministic recomputation`
5. `feat(mobile): add private version history screens`
6. `fix(mobile): recover review deletion failures`
7. `test(mobile): protect review privacy and points ethics`
8. `test(mobile): complete review history state coverage`

### Task 9.1: Additive SQL schema v5

- [ ] Create `journey_active_review` singleton, `journey_review_versions`, and migration receipts.
- [ ] Version rows contain parent ID, user-selected title, date, status, payload, and source revision.
- [ ] Metadata list queries must not select payload; detail repository explicitly loads it.
- [ ] Legacy data migration never fabricates completed history: provable completion → completed, otherwise incomplete.

### Task 9.2: One active draft and immutable versions

- [ ] RED: autosave updates only the active draft.
- [ ] RED: completion/checkpoint creates an immutable version.
- [ ] RED: starting while another draft exists resumes or asks to replace; it never creates two active drafts.
- [ ] RED: replacement first preserves the previous draft as an incomplete snapshot.

### Task 9.3: Branching and deterministic recomputation

- [ ] Forking from history leaves the source version unchanged and sets `parentVersionId`.
- [ ] Upstream selections deterministically recalculate preparation/card generated text.
- [ ] User-edited text survives; changed generated text sets `needsReview: true` and resets the affected share visibility to `pending` so an earlier confirmation is not inherited silently.
- [ ] Copied point-event keys prevent duplicate points and never depend on content, save choice, or length.

### Task 9.4: Private history and deletion

- [ ] Lists expose only title/date/status to visuals and VoiceOver.
- [ ] Detail loads sensitive payload only after explicit navigation.
- [ ] Single delete requires confirmation and transaction rollback; children survive with parent set null.
- [ ] Delete-all reports close/remove/key/reinitialize partial failures honestly and offers recovery; no optimistic success.
- [ ] Empty/loading/storage-error/saved/copy-failure/reset/delete-confirmation states all have actions.

After verification, open stacked PR 3 against the Plan 06D branch. Do not merge.

---

## 14. Verification gates for every phase and final delivery

### Required commands

```powershell
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm --filter @cave/mobile test
corepack pnpm --filter @cave/mobile expo:doctor
corepack pnpm test:content
corepack pnpm validate:content:draft
corepack pnpm validate:content
corepack pnpm test:safety
git diff --check
git status --short
git diff --name-status <phase-base>...HEAD
```

Production validation may remain non-zero only for explicitly listed expert-pending items. Any schema, missing-source, duplicate-ID, invalid-practice, or broken-link metadata error is a real failure.

### Forbidden and privacy scans

- No OpenAI/Anthropic/AI SDK, model, prompt, gateway, fetch client, account, cloud-sync, marketplace, community, or readiness-score imports.
- `Linking.openURL` is allowed only for explicit source links and is never a data-fetch path.
- Raw SQL is allowed only inside infrastructure repositories/migrations, never UI/domain/controller code.
- No sensitive journal/card/practice value in `console`, route params, errors, history list rows, accessibility list labels, snapshots, or analytics.
- No enabled cloud action, auto-share, auto-dial, microphone request, or AI-looking typing indicator.

### Automated experience matrix

- Seven screens: every blueprint section-14 state.
- Long-term shell: first run, completion handoff, cold-start guard, four direct tabs, unfinished review, settings, delete-all.
- History: multi-version, restore, fork, recompute, needsReview, metadata-only list, single/all delete recovery.
- Global: 360×780, 320pt defense, 200% font, keyboard, reduced motion, focus restoration, screen-reader order, 44×44, non-color state, no truncation, no empty entry, no navigation dead end.

### Evidence labels

- `local_automated_pass`: unit/integration/type/lint/content-draft/safety results.
- `expo_go_memory_visual_pass`: only behavior actually observed in Expo Go during one session.
- `content_expert_review_pending`: source/copy/medical items with real pending records.
- `production_content_validation_pending`: expected production validation result until review evidence is committed.
- `device_external_pending`: physical iPhone, VoiceOver, keyboard, SQLCipher, SecureStore, signing, and true cold-start evidence not actually run.

---

## 15. Automatic execution protocol after approval

- Work continuously through Phases 0–9 without asking the user to babysit routine choices.
- Use subagents only on disjoint write sets. A phase with overlapping route/domain/page files is sequential.
- Every behavior follows RED → recorded failure → minimal GREEN → focused verification → full phase verification → independent spec review → independent quality review → English commit.
- Preserve unrelated user changes and never use destructive reset/checkout. Resolve syncs with merge or explicitly documented additive migration.
- If a blocker is an unavailable external reviewer/device/signing credential, continue all local work and record the exact `pending` evidence instead of fabricating a pass.
- Stop and request user authority only for destructive data operations outside tests, new paid/external services, credentials, or merging a PR into `main`.
- Final delivery reports all branch heads, PR URLs, upstream sync commits/conflicts, test counts, local visual status, content status, and external device status.

---

## 16. Plan self-review checklist

- [x] Seven screens replace eight; no independent Page 8 remains.
- [x] Current verified 06A/06B work is preserved and parameterized, not discarded.
- [x] The long-term four-tab direction is included without showing tabs during first run.
- [x] Versioned history, single active draft, branching, recomputation, deletion, and metadata privacy are covered.
- [x] The medical asset and source registry are implemented without false expert-review claims.
- [x] Major visual, content, interaction, persistence, export, accessibility, and error states have explicit phases.
- [x] No AI/account/network/cloud implementation or readiness scoring is introduced.
- [x] PRs remain unmerged without explicit user approval.
- [x] There are no TBD/TODO placeholders; external evidence is named as a status, not an implementation omission.

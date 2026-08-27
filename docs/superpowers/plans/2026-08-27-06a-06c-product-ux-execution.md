# Plan 06A—06C Product UX Execution Plan

> **Historical checkpoint:** `origin/main@ccb188b` replaced the eight-screen product scope with the approved seven-screen specification. Preserve the completed primitive/async/accessibility commits, but use `2026-08-27-seven-screen-complete-product-implementation.md` for all further implementation.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` for implementation and `superpowers:verification-before-completion` before every phase commit. Parallel workers must stay inside their assigned write sets and must not commit independently.

**Goal:** Complete Plan 06 in three independently auditable phases while Plan 05D continues in an isolated branch.

**Architecture:** Phase 06A creates dependency-free semantic design contracts and reusable React Native primitives without touching the journey routes or feature UI. After Plan 05D merges, Phase 06B synchronizes that merged UI and adopts the primitives across the linear eight-page journey. Phase 06C closes state, responsive text, keyboard, reduced-motion, and accessibility gaps while preserving honest local, content-review, and device evidence boundaries.

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript strict, Jest, React Native Testing Library, semantic design tokens.

---

## Fixed boundaries

- The branch is `codex/plan-06-product-ux`, created from fetched `origin/main@ca8750941aae6fccce063f45ff0937b90e3ac958`.
- Until Plan 05D is merged into `origin/main`, only Phase 06A may write files.
- Phase 06A may write only:
  - `apps/mobile/src/config/brand.ts` and its test;
  - `apps/mobile/src/core/design/{tokens,theme,motion}.ts` and their tests;
  - `apps/mobile/src/core/ui/{Screen,Card,Button,ChoiceChip,ProgressHeader,StatusBanner,EmptyState,ErrorState}.tsx` and their tests;
  - this Plan 06 execution document and Plan 06 evidence documents.
- Phase 06A must not write `apps/mobile/src/features/journey/ui/**`, `apps/mobile/app/**`, runtime composition, domain, repositories, controllers, shared contracts, or content fixtures.
- The 23 journey fixtures remain draft. Content freeze, final medical artwork, and production validation are recorded as `content_review_paused`; no `reviewedAt` value is added or changed.
- Apple/signing, physical-iPhone SQLCipher, and physical-iPhone VoiceOver evidence remain `external_pending`. Expo Go can prove only the local JavaScript visual/demo path.
- No account, AI, network, cloud sync, readiness score, tabs, course hub, records hub, profile hub, community, or store is added.

## Phase 06A — Design contracts and reusable primitives

### Task 06A.1: Brand, tokens, theme, motion, and contrast

**Files:**

- Create: `apps/mobile/src/config/brand.test.ts`
- Create: `apps/mobile/src/config/brand.ts`
- Create: `apps/mobile/src/core/design/tokens.test.ts`
- Create: `apps/mobile/src/core/design/contrast.test.ts`
- Create: `apps/mobile/src/core/design/motion.test.ts`
- Create: `apps/mobile/src/core/design/tokens.ts`
- Create: `apps/mobile/src/core/design/theme.ts`
- Create: `apps/mobile/src/core/design/motion.ts`

- [ ] **RED:** Assert the canonical `cave` slug, `内界 CAVE` display name, `听见身体，确认边界。` slogan, semantic light-theme roles, a 44-point minimum touch target, non-zero focus width, text scale-safe line heights, and reduced-motion durations of zero.
- [ ] **RED:** Add a real WCAG sRGB luminance helper in the test and assert at least 4.5:1 for body text on background/surface and 3:1 for large/interactive text and non-text boundaries.
- [ ] **Verify RED:** Run the five focused test files; expect failure because the modules do not exist.
- [ ] **GREEN:** Implement immutable semantic token groups (`color`, `typography`, `space`, `radius`, `size`, `border`, `motion`), a light `theme`, and a `motionFor(reduceMotion)` selector. Do not add platform, network, journey, or SQL imports.
- [ ] **Verify GREEN:** Re-run the five focused test files; expect all assertions to pass.

### Task 06A.2: Responsive containers and non-interactive states

**Files:**

- Create: `apps/mobile/src/core/ui/Screen.test.tsx`
- Create: `apps/mobile/src/core/ui/Card.test.tsx`
- Create: `apps/mobile/src/core/ui/FeedbackStates.test.tsx`
- Create: `apps/mobile/src/core/ui/Screen.tsx`
- Create: `apps/mobile/src/core/ui/Card.tsx`
- Create: `apps/mobile/src/core/ui/EmptyState.tsx`
- Create: `apps/mobile/src/core/ui/ErrorState.tsx`

- [ ] **RED:** Assert `Screen` uses a vertical `ScrollView`, automatic inset adjustment, keyboard-preserving tap behavior, a bounded readable content width, and caller-supplied test/accessibility props.
- [ ] **RED:** Assert `Card` exposes semantic surface variants without relying on color for meaning and retains accessible grouped content.
- [ ] **RED:** Assert empty/error states have visible titles/messages, appropriate live regions, optional recovery actions, and recovery targets of at least 44×44.
- [ ] **Verify RED:** Run these focused UI tests; expect missing-module failures.
- [ ] **GREEN:** Implement the smallest dependency-free components using the 06A theme and React Native primitives only.
- [ ] **Verify GREEN:** Re-run the focused UI tests; expect all assertions to pass.

### Task 06A.3: Controls, progress, and status

**Files:**

- Create: `apps/mobile/src/core/ui/Button.test.tsx`
- Create: `apps/mobile/src/core/ui/ChoiceChip.test.tsx`
- Create: `apps/mobile/src/core/ui/ProgressHeader.test.tsx`
- Create: `apps/mobile/src/core/ui/StatusBanner.test.tsx`
- Create: `apps/mobile/src/core/ui/Button.tsx`
- Create: `apps/mobile/src/core/ui/ChoiceChip.tsx`
- Create: `apps/mobile/src/core/ui/ProgressHeader.tsx`
- Create: `apps/mobile/src/core/ui/StatusBanner.tsx`

- [ ] **RED:** Assert `Button` supports default, pressed, disabled, and loading behavior; disables duplicate activation while loading; has a 44×44 minimum target; and exposes a text label plus accessibility state.
- [ ] **RED:** Assert `ChoiceChip` supports checkbox/radio semantics, exposes checked/selected state in accessibility state and visible text/marker, and never uses color as the only selected-state signal.
- [ ] **RED:** Assert `ProgressHeader` announces `第 n 页，共 8 页`, validates its numeric bounds, and conditionally exposes back/exit actions with 44×44 targets and explicit labels.
- [ ] **RED:** Assert `StatusBanner` uses icon/text/role semantics for info, success, warning, and error; errors are assertive and recoverable actions are labelled.
- [ ] **Verify RED:** Run the four focused UI tests; expect missing-module failures.
- [ ] **GREEN:** Implement the smallest theme-backed components without importing journey code or adding animation dependencies.
- [ ] **Verify GREEN:** Re-run the focused UI tests; expect all assertions to pass.

### Task 06A.4: Phase review, evidence, and commit

- [ ] Run a spec-compliance review against this file and `2026-08-26-06-product-completion-ux.md`.
- [ ] Run an independent code-quality review of the complete 06A diff.
- [ ] Run mobile typecheck, lint, all mobile tests, focused contrast/touch/accessibility tests, Expo Doctor, draft content validation, safety regression, boundary scans, and `git diff --check`.
- [ ] Confirm the diff contains no 05D-owned path and no `reviewedAt` change.
- [ ] Record `local visual pass` only for locally rendered/tested behavior; record `content_review_paused` and `external_pending` separately.
- [ ] Commit in English: `feat(mobile): add accessible product design primitives`.

## Phase 06B — Eight-screen visual adoption (locked until Plan 05D merge)

- [ ] Fetch `origin` again and prove the 05D merge commit is an ancestor of `origin/main`.
- [ ] Non-destructively integrate the new `origin/main`; record the exact sync commit and every conflict resolution.
- [ ] Write small-screen and large-text RED tests for Pages 1—8 before changing feature UI.
- [ ] Replace raw visual primitives in the eight existing journey screens with the 06A contracts while retaining 05D behavior and controller/runtime boundaries.
- [ ] Keep a linear eight-page journey with `ProgressHeader`, explicit back/exit actions, and a bottom primary CTA; do not create tabs or empty destinations.
- [ ] Keep Page 6 visibly scripted, Page 7 explicitly non-gating, cloud disabled, and point calculation independent from sensitive choices/text.
- [ ] Verify every screen has no truncation or dead end under the supported small-screen/large-text matrix.
- [ ] Commit in English: `feat(mobile): unify the eight-page journey experience`.

## Phase 06C — State and accessibility closure (locked until 06B)

- [ ] Write RED state-matrix tests for loading, validation error, storage error, empty output, saved, copy failure, and reset confirmation.
- [ ] Write RED keyboard, Dynamic Type, reduced-motion, minimum-touch-target, and focus-restoration tests.
- [ ] Implement explicit recovery actions and safe return paths without logging sensitive text.
- [ ] Verify Page 1—8 locally in Expo Go and report it only as `local visual pass` / temporary-memory demo evidence.
- [ ] Keep final journey copy, medical artwork, and production content validation at `content_review_paused`.
- [ ] Keep Apple/signing, physical-iPhone SQLCipher, and physical-iPhone VoiceOver evidence at `external_pending`.
- [ ] Commit in English: `fix(mobile): complete resilient accessible journey states`.

## Final verification and PR

- [ ] Run `corepack pnpm typecheck`.
- [ ] Run `corepack pnpm lint`.
- [ ] Run `corepack pnpm --filter @cave/mobile test`.
- [ ] Run `corepack pnpm --filter @cave/mobile expo:doctor`.
- [ ] Run `corepack pnpm validate:content:draft` and record production validation's expected draft failure honestly.
- [ ] Run `corepack pnpm test:safety`.
- [ ] Scan for AI/network/raw SQL/readiness/cloud-enable additions and sponsor runtime forks.
- [ ] Run `git diff --check` and inspect `git diff --name-status origin/main...HEAD`.
- [ ] Push `codex/plan-06-product-ux` and open a PR without merging it.
- [ ] Final report must list the actual 05D sync commit/conflicts and distinguish `local visual pass`, `content_review_paused`, and device `external_pending`.

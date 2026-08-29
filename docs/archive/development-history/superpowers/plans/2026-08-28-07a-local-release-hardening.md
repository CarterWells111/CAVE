# Plan 07A Local Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the Apple-independent, feature-frozen CAVE release surface with reproducible local automation and honest evidence, without creating a release candidate or unlocking Plan 08.

**Architecture:** Plan 07 is split into a local 07A gate and an external 07B gate. 07A adds repository-owned source-policy scans, deterministic stress and acceptance tests, current seven-screen Maestro specifications, and runbooks; 07B retains every signed-build, real-device, native-security, accessibility, performance, and rehearsal requirement.

**Tech Stack:** Node 24, pnpm 10, Expo SDK 54, TypeScript, Vitest, Jest, React Native Testing Library, Expo export, Maestro YAML, Cloudflare Wrangler dry-run.

---

## Authority, base, and non-goals

- Approved execution date: 2026-08-28.
- Branch: `codex/plan-07a-local-hardening`.
- Initial execution base: `origin/main@9f244ce3d4b9eedec826a9bf918e81000b83fce4`.
- Final integration base: `origin/main@8837eafd7b1b046d7e3590778be5c9cef3ced74f`, merged non-destructively in `a05556f199058d3dd935e790ee5b41db517ab574` after Plan 04 PR #16 merged.
- The planning-time base `715ff6f618848a41e57cb79dd43f0e163bfc470c` is superseded by the recorded execution bases above.
- Feature freeze is active. No new feature, public interface, content, medical-review assertion, redesign, account, cloud, community, store, or Gateway runtime consumer is allowed.
- Plan 04 owns Gateway safety-policy/evaluator code and its evidence document. 07A must not edit or copy that parallel work.
- `reviewStatus`, Golden expectations, and `reviewedAt` remain owned by their reviewers. Production validation must fail honestly while draft/expert-pending records remain.
- `pnpm audit --prod` is not authorized because it sends dependency metadata to npm.
- No Apple login, signing, EAS iOS build, device registration, Worker deployment, canary logging, physical-device SQLCipher/SecureStore verification, real Maestro execution, formal rehearsal, RC tag, or final tag is part of 07A.

## Plan 07 split

### 07A — Apple-independent local automation and release preparation

07A owns reproducible install, typecheck, lint, tests, content-draft validation, honest production-content validation, safety regression, Gateway dry-run build, iOS JavaScript export, bundle-secret scan, deterministic source-policy scans, seven-screen/shell/history/delete/stress coverage, current Maestro specifications, and local demo/known-issue runbooks.

The strongest successful status is `local_automated_pass`. It means only that every authorized local gate passed freshly on the recorded commit.

### 07B — signed build and external release evidence

07B owns Apple authentication and signing; signed Development/Preview builds; real-device SQLCipher, SecureStore/Keychain, media-library, external-link, and upgrade verification; VoiceOver and device Dynamic Type; real Maestro execution; cold-launch, native-memory, and device interaction measurements; Worker deployment/canary log inspection; and three formal rehearsals.

07B also owns any release-candidate or final tag. Passing 07A does not complete Plan 07, does not create a tag, and does not unlock Plan 08.

## Canonical release surface

- First run is exactly seven canonical screens. Screen 1 has no numeric progress; Screens 2–7 use a total of seven.
- Screen 7 combines private preparation, partner-visible communication-card editing, local save/export/copy, and completion results.
- The long-term shell has exactly four tabs: Home, Reviews, Practice, and Cards. Settings is outside the tab bar.
- Reviews use one active draft plus immutable versions. Replacement archives the prior draft; completion writes a version and clears active state; branching preserves source history and marks regenerated content for review.
- Delete-one detaches child ancestry transactionally. Delete-all clears active/history/card state and reports partial native cleanup honestly.
- No readiness score, percentage, inferred readiness, AI/model/Gateway consumption, recording path, automatic permission request, or sensitive message/body logging may enter the seven-screen Demo flow.

## Verification statuses

The final evidence must always list these independently:

- `content_expert_review_pending`
- `production_content_validation_pending`
- `expo_go_human_visual_pending`
- `device_external_pending`
- `npm_audit_authorization_pending`
- `worker_deployment_pending`

The conditional `plan_04_merge_sync_pending` status is cleared only by the final integration evidence: both Plan 04 merge `8837eafd` and head `c2be26a2` are ancestors of the branch, and the complete matrix has been rerun.

## Task 1: Define the local gate and evidence templates

**Files:**

- Create: `docs/superpowers/plans/2026-08-28-07a-local-release-hardening.md`
- Create: `docs/runbooks/verification-matrix.md`
- Create: `docs/runbooks/known-issues.md`
- Create: `docs/runbooks/local-demo-checklist.md`

- [ ] Record the actual branch/base and the 07A/07B ownership split.
- [ ] Replace obsolete eight-screen acceptance language with seven-screen, four-tab, and version-history behavior.
- [ ] Define severity: P0 is safety/data loss/release-blocking; P1 breaks a release-critical secondary path; P2 is accepted non-blocking polish or device-only evidence.
- [ ] Define the command/evidence schema and pending-status vocabulary.
- [ ] Verify docs contain no RC/final tag instruction and do not unlock Plan 08.
- [ ] Commit exactly: `docs: define local release hardening gate`.

## Task 2: Add deterministic local verification assets with TDD

**Files:**

- Create: `scripts/verify-mobile-source-policy.mjs`
- Create: `tests/verify-mobile-source-policy.test.ts`
- Create: `apps/mobile/src/test/release-critical-stress.test.ts`
- Create: `.maestro/core-flow.yaml`
- Create: `.maestro/back-edit.yaml`
- Create: `.maestro/offline-delete.yaml`
- Modify: `package.json`

- [ ] RED: add a root test proving the source-policy scanner fails on AI/model/Gateway consumption, recording APIs, automatic permission requests outside the explicit image-save adapter, sensitive logging, and readiness-score code in Demo-owned source.
- [ ] Run `corepack pnpm vitest run tests/verify-mobile-source-policy.test.ts`; expected failure is a missing scanner or missing policy script.
- [ ] GREEN: implement the smallest deterministic scanner and `verify:mobile-policy` root command.
- [ ] Re-run the focused root test and direct scanner; expect exit 0 on repository source.
- [ ] RED: add deterministic stress tests for ten reset/start cycles, repeated version add/branch/delete behavior, longest metadata/history payloads, and failed-write recovery without duplicate committed state.
- [ ] Run the focused mobile test; confirm the new assertions execute and fail for the missing release-stress contract or fixture behavior.
- [ ] GREEN: add only test harness/helpers or the smallest P0/P1 fix required by a reproducible failure. Do not change production behavior for test convenience.
- [ ] Re-run focused and full mobile tests.
- [ ] Add Maestro specifications using current seven-screen labels and the four-tab/history/delete behavior. Record them as static specifications only; do not claim execution.
- [ ] Commit exactly: `test: harden seven-screen release paths`.

## Task 3: Run and record every authorized local gate

**Files:**

- Modify: `docs/runbooks/verification-matrix.md`
- Modify: `docs/runbooks/known-issues.md`
- Modify: `docs/runbooks/local-demo-checklist.md`

- [ ] Run `CI=true corepack pnpm install --frozen-lockfile --offline` after populating the exact frozen store if necessary.
- [ ] Run workspace typecheck, lint, full tests, content tests, draft validation, safety tests, and Gateway dry-run build separately; record command, duration, exit code, and exact test/build counts.
- [ ] Run production content validation; record the real non-zero draft/expert-review failure without modifying review metadata.
- [ ] Export an iOS JavaScript bundle to an untracked temporary directory and run `security:scan-bundle` against it.
- [ ] Run the source-policy scanner and targeted seven-screen/shell/history/delete/stress suites.
- [ ] Record that device launch timing, native memory, VoiceOver, real Maestro, signing, Worker deployment, audit, and rehearsals remain pending.
- [ ] Record every reproducible P0/P1 fix and every accepted P2 issue. If no P0/P1 is found, say so explicitly.
- [ ] Commit exactly: `docs: record local release verification`.

## Task 4: Independent review and final branch verification

- [ ] Request independent spec-compliance review against this plan and the approved delegation.
- [ ] Request independent code-quality review of `origin/main...HEAD`.
- [ ] Resolve every verified Critical/Important finding in scope. Any behavior fix must follow RED → observed failure → minimal GREEN → focused pass → full verification.
- [ ] Fetch `origin` again and determine whether Plan 04 has merged to `origin/main`.
- [ ] If merged, non-destructively sync the latest `origin/main` and rerun the entire matrix including its new Golden evaluator/TurnService tests.
- [ ] If not merged, leave `plan_04_merge_sync_pending`; do not wait indefinitely or copy Plan 04 changes.
- [ ] Run `git diff --check`, inspect `git diff --name-status origin/main...HEAD`, and record `git status --short`.
- [ ] Push `codex/plan-07a-local-hardening` and open a PR targeting `main`. Do not merge.

## Completion rule

07A may be labeled `local_automated_pass` only when every authorized runnable local command in the final matrix has fresh exit-0 evidence, with production validation separately recorded as an expected pending gate. Plan 07 remains incomplete, Plan 08 remains locked, and the PR remains unmerged.

# Plan 07A local verification matrix

Updated: 2026-08-28

Branch: `codex/plan-07a-local-hardening`  
Base: `origin/main@9f244ce3d4b9eedec826a9bf918e81000b83fce4`

## Status contract

- Overall 07A status: `local_automated_pass` for the authorized local gates recorded below.
- Plan 07 overall remains incomplete. Plan 08 remains locked.
- No RC or final tag is created by this matrix.

## Automated gates

| Gate | Fresh command | Exit | Duration | Evidence |
|---|---|---:|---:|---|
| Frozen offline install | `$env:CI='true'; corepack pnpm install --frozen-lockfile --offline` | 0 | 1.56 s | All 7 projects already up to date; lockfile unchanged; 1,093 packages had previously been populated from the same frozen lockfile without audit. |
| Workspace typecheck | `corepack pnpm typecheck` | 0 | 5.17 s | All 6 scoped workspace projects passed. |
| Workspace lint | `corepack pnpm lint` | 0 | 6.31 s | All 6 scoped workspace projects passed with zero warnings. |
| Full tests | `corepack pnpm test` | 0 | 28.86 s | 119 suites / 825 tests: mobile 91/578, Gateway 16/160, contracts 4/19, content 4/39, scenario engine 2/18, fixtures 2/11. |
| Content tests | `corepack pnpm test:content` | 0 | 2.01 s | 4 files / 39 tests passed. |
| Draft validation | `corepack pnpm validate:content:draft` | 0 | 1.96 s | 1 course, 1 lesson, and 3 scenarios passed draft validation. |
| Production validation | `corepack pnpm validate:content` | 1 | 1.34 s | Expected honest gate: checked-in `DRAFT_CONTENT` and `EXPERT_REVIEW_PENDING` entries were reported. No `reviewedAt` or review state changed. Status remains `production_content_validation_pending`. |
| Safety tests | `corepack pnpm test:safety` | 0 | 1.56 s | 4 files / 53 tests passed. This is the pre-Plan-04-merge baseline and does not claim PR #16's evaluator integration. |
| Gateway dry-run | `corepack pnpm build:gateway` | 0 | 7.08 s | Wrangler 4.126.0 dry-run; 726.90 KiB upload / 121.40 KiB gzip; no deployment. A prior sandbox-only attempt exited 1 because Wrangler could not write its host log or traverse the linked worktree; the identical host-permission retry passed. |
| iOS export | `apps/mobile/node_modules/.bin/expo.CMD export --platform ios --output-dir dist --clear` from `apps/mobile` | 0 | 31.8 s | Hermes bundle: 1 bundle, 3.65 MB, 1,202 modules; 24 assets including the 309 kB medical illustration; 1 metadata file. The filter-form command first exited 1 because Windows did not resolve the Expo shim; the pinned workspace shim above passed. |
| Bundle secret scan | `corepack pnpm security:scan-bundle` | 0 | 0.80 s | 26 exported files passed. |
| Mobile source policy | `corepack pnpm verify:mobile-policy` | 0 | 0.96 s | 122 production files passed: 93 under `apps/mobile/src` and 29 Expo Router files under `apps/mobile/app`. The AST-based scan covers AI/model/Gateway consumption, recording APIs, permission requests, sensitive logs, and readiness-score implementation. |
| Policy and Maestro specification tests | `node_modules/.bin/vitest.CMD run tests/verify-mobile-source-policy.test.ts tests/maestro-static-specs.test.ts` | 0 | 8.73 s | 2 files / 40 tests passed. Maestro YAML was parsed and selector-locked, not executed. |
| Critical-path/stress tests | `corepack pnpm --filter @cave/mobile test -- src/test/release-critical-stress.test.ts src/features/journey/journey-production-flow.integration.test.tsx src/features/journey/journey-production-navigation.integration.test.tsx src/features/shell/shell-routes.integration.test.ts src/features/reviews/review-history.integration.test.ts src/core/privacy/delete-all-data.test.ts` | 0 | 5.52 s | 6 suites / 21 tests passed: seven-screen first run, back/edit propagation, four-tab shell, production-composed reset/history/branch/delete/recovery stress, and delete-all. |
| Diff check | `git diff --check` | 0 | <1 s | No whitespace errors. Generated `apps/mobile/dist` and Gateway `dist` outputs remain ignored. |

## Static Maestro specifications

The `.maestro` flows are reviewed for current seven-screen semantics only. They are not executed or counted as a local pass. `offline-delete.yaml` verifies local-state deletion but explicitly delegates offline transport setup to 07B because Maestro's airplane-mode command has no effect on iOS. Real execution belongs to 07B.

## Automated acceptance coverage

- Exactly seven canonical first-run routes, Screen 1 without numeric progress, and Screens 2–7 with a total of seven.
- Back navigation, upstream editing propagation, final communication-card confirmation, and absence of readiness scoring.
- Exactly four long-term tabs with Settings outside the tab bar.
- One active review, immutable versions, replacement archive, branch recomputation/review flags, delete-one ancestry detachment, and delete-all.
- Ten reset/start cycles, ten version add/branch/delete cycles, 16,384-character payload preservation, payload-free history metadata, and failed-completion retry without duplicate history.
- No mobile source integration with AI/model/Gateway, recording APIs, automatic permissions outside the explicit image-save operation, sensitive message/body logs, or readiness-score implementation.

No product P0/P1 defect was reproduced. Independent review did reproduce and close release-tooling P1 gaps in the scanner, runtime stress harness, and Maestro selectors through additional RED/GREEN tests inside commit `301227e`.

## Pending external and authorization gates

- `content_expert_review_pending`
- `production_content_validation_pending`
- `expo_go_human_visual_pending`
- `device_external_pending`
- `npm_audit_authorization_pending`
- `worker_deployment_pending`
- `plan_04_merge_sync_pending`

The final fetch left `origin/main` at `9f244ce3d4b9eedec826a9bf918e81000b83fce4`. `git merge-base --is-ancestor c2be26a2a510238b22d3b22274933c1a38fedede origin/main` exited 1, so Plan 04 PR #16 has not merged. Before this PR can be merged, sync the `origin/main` that contains PR #16 and rerun this entire matrix, including its evaluator/TurnService regressions.

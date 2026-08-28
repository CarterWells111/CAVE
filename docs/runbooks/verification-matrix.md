# Plan 07A local verification matrix

Updated: 2026-08-28

Branch: `codex/plan-07a-local-hardening`

Initial base: `origin/main@9f244ce3d4b9eedec826a9bf918e81000b83fce4`

Final integration base: `origin/main@8837eafd7b1b046d7e3590778be5c9cef3ced74f`

Integration commit: `a05556f199058d3dd935e790ee5b41db517ab574`

## Status contract

- Overall 07A status: `local_automated_pass` for the authorized local gates recorded below.
- Plan 07 overall remains incomplete. Plan 08 remains locked.
- No RC or final tag is created by this matrix.

## Automated gates

| Gate | Fresh command | Exit | Duration | Evidence |
|---|---|---:|---:|---|
| Frozen offline install | `$env:CI='true'; corepack pnpm install --frozen-lockfile --offline` | 0 | 2.29 s | All 7 projects already up to date; lockfile unchanged; no audit performed. |
| Workspace typecheck | `corepack pnpm typecheck` | 0 | 6.70 s | All 6 scoped workspace projects passed. |
| Workspace lint | `corepack pnpm lint` | 0 | 6.23 s | All 6 scoped workspace projects passed with zero warnings. |
| Full tests | `corepack pnpm test` | 0 | 29.20 s | 119 suites / 840 tests: mobile 91/578, Gateway 16/175, contracts 4/19, content 4/39, scenario engine 2/18, fixtures 2/11. |
| Root release-tool tests | `corepack pnpm test:ci-config` | 0 | 12.77 s | 7 files / 75 tests passed, including fail-closed canary cases for bundle-secret and mobile-policy tooling. |
| Plan 04 evaluator/TurnService regressions | `node_modules/.bin/vitest.CMD run --root apps/gateway test/safety-policy.test.ts test/turn-service.test.ts` | 0 | 1.65 s | 2 files / 41 tests passed against the real `createTurnSafetyEvaluator` and production `TurnService` integration. |
| Content tests | `corepack pnpm test:content` | 0 | 2.70 s | 4 files / 39 tests passed. |
| Draft validation | `corepack pnpm validate:content:draft` | 0 | 0.52 s | 1 course, 1 lesson, and 3 scenarios passed draft validation. |
| Production validation | `corepack pnpm validate:content` | 1 | 1.87 s | Expected honest gate: 56 `DRAFT_CONTENT` and 34 `EXPERT_REVIEW_PENDING` entries were reported. No `reviewedAt` or review state changed. Status remains `production_content_validation_pending`. |
| Safety tests | `corepack pnpm test:safety` | 0 | 2.34 s | 4 files / 66 tests passed after the Plan 04 merge. |
| Gateway dry-run | `corepack pnpm build:gateway` | 0 | 3.92 s | Wrangler 4.126.0 dry-run; 727.47 KiB upload / 121.61 KiB gzip; no deployment. |
| iOS export | `apps/mobile/node_modules/.bin/expo.CMD export --platform ios --output-dir dist --clear` from `apps/mobile` | 0 | 23.72 s | Hermes bundle: 1 bundle, 3.65 MB, 1,202 modules; 24 assets including the 309 kB medical illustration; 1 metadata file. |
| Bundle secret scan | `corepack pnpm security:scan-bundle` | 0 | 0.75 s | 26 exported files passed. |
| Mobile source policy | `corepack pnpm verify:mobile-policy` | 0 | 1.21 s | 122 production files passed: 93 under `apps/mobile/src` and 29 Expo Router files under `apps/mobile/app`. The AST-based scan forbids mobile network access, recording APIs, permission-method references outside the exact image-save call, dynamic production logs, and readiness implementation. |
| Policy and Maestro specification tests | `node_modules/.bin/vitest.CMD run tests/verify-mobile-source-policy.test.ts tests/maestro-static-specs.test.ts` | 0 | 13.06 s | 2 files / 49 tests passed. All three Maestro files were parsed as YAML and selector-locked, not executed. |
| Critical-path/stress tests | `corepack pnpm --filter @cave/mobile test -- src/test/release-critical-stress.test.ts src/features/journey/journey-production-flow.integration.test.tsx src/features/journey/journey-production-navigation.integration.test.tsx src/features/shell/shell-routes.integration.test.ts src/features/reviews/review-history.integration.test.ts src/core/privacy/delete-all-data.test.ts` | 0 | 7.52 s | 6 suites / 21 tests passed: seven-screen first run, back/edit propagation, four-tab shell, production-composed reset/history/branch/delete/recovery stress, and delete-all. |
| Branch-range diff check | `git diff --check origin/main...HEAD` | 0 | <1 s | No whitespace errors across the complete release branch. Generated `apps/mobile/dist` and Gateway `dist` outputs remain ignored. |

## Static Maestro specifications

The `.maestro` flows are reviewed for current seven-screen semantics only. They are not executed or counted as a local pass. `offline-delete.yaml` verifies local-state deletion but explicitly delegates offline transport setup to 07B because Maestro's airplane-mode command has no effect on iOS. Real execution belongs to 07B.

## Automated acceptance coverage

- Exactly seven canonical first-run routes, Screen 1 without numeric progress, and Screens 2–7 with a total of seven.
- Back navigation, upstream editing propagation, final communication-card confirmation, and absence of readiness scoring.
- Exactly four long-term tabs with Settings outside the tab bar.
- One active review, immutable versions, replacement archive, branch recomputation/review flags, delete-one ancestry detachment, and delete-all.
- Ten reset/start cycles, ten version add/branch/delete cycles, 16,384-character payload preservation, payload-free history metadata, and failed-completion retry without duplicate history.
- No mobile source integration with AI/model/Gateway, recording APIs, automatic permissions outside the explicit image-save operation, sensitive message/body logs, or readiness-score implementation.

No product P0/P1 defect was reproduced. Independent review reproduced and closed the initial release-tooling P1 gaps in commit `301227e`; remaining fail-closed scanner aliases and YAML-evidence gaps are closed by the follow-up policy fix commit.

## Pending external and authorization gates

- `content_expert_review_pending`
- `production_content_validation_pending`
- `expo_go_human_visual_pending`
- `device_external_pending`
- `npm_audit_authorization_pending`
- `worker_deployment_pending`

Plan 04 integration is complete: `origin/main@8837eafd7b1b046d7e3590778be5c9cef3ced74f` contains both merge `8837eafd` and Plan 04 head `c2be26a2`; both ancestry checks exit 0 from branch integration commit `a05556f`. The conditional `plan_04_merge_sync_pending` status is therefore cleared.

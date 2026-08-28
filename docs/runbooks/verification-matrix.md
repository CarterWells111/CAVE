# Plan 07A local verification matrix

Updated: 2026-08-28

Branch: `codex/plan-07a-local-hardening`  
Base: `origin/main@9f244ce3d4b9eedec826a9bf918e81000b83fce4`

## Status contract

- Overall 07A status begins as `in_progress` and may become only `local_automated_pass` after fresh local evidence is recorded.
- Plan 07 overall remains incomplete. Plan 08 remains locked.
- No RC or final tag is created by this matrix.

## Automated gates

| Gate | Command | Expected result | Fresh result |
|---|---|---|---|
| Frozen offline install | `CI=true corepack pnpm install --frozen-lockfile --offline` | exit 0, lockfile unchanged | pending |
| Workspace typecheck | `corepack pnpm typecheck` | exit 0 | pending |
| Workspace lint | `corepack pnpm lint` | exit 0 | pending |
| Full tests | `corepack pnpm test` | exit 0, exact counts recorded | pending |
| Content tests | `corepack pnpm test:content` | exit 0, exact counts recorded | pending |
| Draft validation | `corepack pnpm validate:content:draft` | exit 0 | pending |
| Production validation | `corepack pnpm validate:content` | expected non-zero while expert review is pending | pending evidence, never converted to pass |
| Safety tests | `corepack pnpm test:safety` | exit 0, exact counts recorded | pending |
| Gateway dry-run | `corepack pnpm build:gateway` | exit 0, output size recorded | pending |
| iOS export | `corepack pnpm --filter @cave/mobile exec expo export --platform ios --output-dir <temporary-path> --clear` | exit 0, bundle/assets recorded | pending |
| Bundle secret scan | `corepack pnpm security:scan-bundle -- <temporary-path>` | exit 0, files scanned recorded | pending |
| Mobile source policy | `corepack pnpm verify:mobile-policy` | exit 0 | pending |
| Critical-path/stress tests | focused Jest/Vitest commands recorded after implementation | exit 0, exact counts recorded | pending |
| Diff check | `git diff --check` | exit 0 | pending |

## Static Maestro specifications

The `.maestro` flows are reviewed for current seven-screen semantics only. They are not executed or counted as a local pass. Real execution belongs to 07B.

## Pending external and authorization gates

- `content_expert_review_pending`
- `production_content_validation_pending`
- `expo_go_human_visual_pending`
- `device_external_pending`
- `npm_audit_authorization_pending`
- `worker_deployment_pending`
- `plan_04_merge_sync_pending`

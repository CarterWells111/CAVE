# Plan 07A known issues

Updated: 2026-08-28

## Severity

- P0: safety or privacy risk, data loss, unusable canonical Demo flow, or release-blocking correctness failure.
- P1: reproducible failure in a release-critical secondary path such as editing propagation, recovery, version history, branching, or deletion.
- P2: non-blocking polish, device-only evidence, or accepted limitation outside the local automated gate.

## Issue register

| ID | Severity | Reproduction | Owner | Decision | Evidence |
|---|---|---|---|---|---|
| 07A-PENDING-01 | P2 | `corepack pnpm validate:content` exits 1 on checked-in draft/expert-pending entries. | Content/medical reviewers | Accept pending; do not alter review metadata. | `content_expert_review_pending`; `production_content_validation_pending`. |
| 07A-PENDING-02 | P2 | Signed-device behavior, VoiceOver, SQLCipher/SecureStore, launch timing, native memory, photo permissions, and real Maestro cannot be proven by local JavaScript automation. | Plan 07B | Accept pending. | `device_external_pending`. |
| 07A-PENDING-03 | P2 | No human Expo Go visual walkthrough was performed by this automated run. | Human visual reviewer | Accept pending. | `expo_go_human_visual_pending`. |
| 07A-PENDING-04 | P2 | Dependency audit would send package metadata to npm and is not authorized. | User authorization | Do not run. | `npm_audit_authorization_pending`. |
| 07A-PENDING-05 | P2 | Worker deployment and canary-log inspection are outside 07A. | Plan 07B | Do not deploy. | `worker_deployment_pending`. |
| 07A-PENDING-06 | P2 | Plan 04 PR #16 is open/passing but commit `c2be26a` is not an ancestor of `origin/main@9f244ce`. | Integration sequencing | Keep this PR unmerged; sync and rerun after PR #16 merges. | `plan_04_merge_sync_pending`. |

## Resolved release-tooling findings

Independent review found no product P0/P1 defect. It did find P1 defects in the new release tooling: an over-broad permission exception, sensitive-log and computed-access scanner evasions, non-fail-closed targets, missing Expo Router coverage, a non-production stress harness, and a stale Maestro history selector. Each was reproduced by a failing test before being fixed in `301227e`; the final reviewer reported no Critical or Important findings.

No P0/P1 product fix commit was required. New product findings still require a deterministic reproduction and failing test before any fix.

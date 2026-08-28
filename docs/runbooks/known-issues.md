# Plan 07A known issues

Updated: 2026-08-28

## Severity

- P0: safety or privacy risk, data loss, unusable canonical Demo flow, or release-blocking correctness failure.
- P1: reproducible failure in a release-critical secondary path such as editing propagation, recovery, version history, branching, or deletion.
- P2: non-blocking polish, device-only evidence, or accepted limitation outside the local automated gate.

## Issue register

| ID | Severity | Reproduction | Owner | Decision | Evidence |
|---|---|---|---|---|---|
| 07A-PENDING-01 | P2 | Production content validation reports checked-in draft/expert-pending entries. | Content/medical reviewers | Accept pending; do not alter review metadata. | Final validation output pending. |
| 07A-PENDING-02 | P2 | Signed-device behavior, VoiceOver, SQLCipher/SecureStore, launch timing, native memory, photo permissions, and real Maestro cannot be proven by local JavaScript automation. | Plan 07B | Accept pending. | `device_external_pending`. |
| 07A-PENDING-03 | P2 | Dependency audit would send package metadata to npm and is not authorized. | User authorization | Do not run. | `npm_audit_authorization_pending`. |
| 07A-PENDING-04 | P2 | Worker deployment and canary-log inspection are outside 07A. | Plan 07B | Do not deploy. | `worker_deployment_pending`. |

No P0/P1 defect has been recorded at plan-definition time. New findings must include a deterministic reproduction and failing test before any fix.

# Plan 07A local demo checklist

Updated: 2026-08-28

This checklist prepares a local walkthrough; it is not evidence of Expo Go observation, a signed build, real Maestro execution, or a formal rehearsal.

Automated preparation status: `local_automated_pass`. Release code under test is anchored at Task 2 commit `301227e381a75b13bf16899fb955048341e7db0f`; the checkout intentionally also contains later verification-evidence and policy-fix commits plus the non-destructive Plan 04 integration at `a05556f199058d3dd935e790ee5b41db517ab574`. The human walkthrough below remains pending.

## Before the walkthrough

- [x] Confirm the checkout is `codex/plan-07a-local-hardening` and its history contains the recorded release-code commit followed by the evidence and policy-fix commits under verification.
- [x] Confirm the verification matrix has fresh local exit codes and no unresolved product P0/P1.
- [x] Confirm production content remains visibly draft/expert-pending and is not described as approved.
- [x] Confirm offline/no-network behavior is represented only by deterministic local-source and runtime tests; do not claim a device observation.

## Seven-screen first run

- [ ] Screen 1: adult gate and local-only address preference; no numeric progress.
- [ ] Screens 2–7: progress total is seven and back navigation preserves prior edits.
- [ ] Screen 6: visibly preset, local, non-AI, and non-recording practice with pause/withdraw behavior.
- [ ] Screen 7: private preparation and partner-visible communication fields remain distinct; save/copy/export require explicit user action.
- [ ] Edit an upstream behavior and confirm generated fields recompute while user-authored text remains and regenerated sharing fields require review.
- [ ] Confirm no readiness score, percentage, or automatic decision appears.

## Four-tab shell and version history

- [ ] After first-run completion, exactly Home, Reviews, Practice, and Cards are available; Settings remains outside tabs.
- [ ] Start, resume, replace, complete, and branch a review; confirm historical versions remain immutable.
- [ ] Open long history/detail content and confirm actions remain reachable by scrolling at large text sizes.
- [ ] Delete one version with confirmation; confirm child lineage is detached safely.
- [ ] Delete all local data with confirmation; confirm success only after repository/native cleanup reports success.

## Honest handoff

- [ ] State `expo_go_human_visual_pending` unless a human actually performs and records the walkthrough.
- [ ] State `device_external_pending` for all signed/native/device evidence.
- [ ] State `content_expert_review_pending` and `production_content_validation_pending`.
- [ ] State `npm_audit_authorization_pending` and `worker_deployment_pending`.
- [x] Confirm `plan_04_merge_sync_pending` is cleared only because `origin/main@8837eafd` was integrated and the full matrix, including the evaluator/TurnService regressions, passed freshly.
- [ ] Do not create RC/final tags or unlock Plan 08.

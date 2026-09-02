# Local Conversation Changes Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Combine the uncommitted six-screen navigation improvements with the current conversation's optional-practice, consent-reminder, and compact-header changes without including unrelated workspace assets.

**Architecture:** Preserve each change set as a separate checkpoint commit, then merge the six-screen checkpoint into `codex/optional-practice-after-draft`. Resolve the shared journey navigation and screen files semantically so internal step-back behavior and the revised journey structure coexist.

**Tech Stack:** Git worktrees, Expo Router, React Native, TypeScript, Jest, ESLint.

**Spec:** User request in the current Codex task on 2026-09-02.

## Global Constraints

- Keep the main checkout's unrelated images, `tmp/`, and `tools/` out of commits.
- Preserve the existing optional-practice flow, consent reminder, renamed reflection content, and reduced header spacing.
- Preserve journey internal-step back behavior, hardware back handling, and edge-swipe handling.
- Push only after local verification, then open a PR, verify its checks, and merge it into remote `main` as explicitly requested.

---

### Task 1: Checkpoint both local change sets

**Files:**
- Modify: tracked journey files already changed in the main checkout
- Create: `apps/mobile/src/features/journey/ui/journey-step-back.tsx`
- Create: `apps/mobile/src/features/journey/ui/journey-step-back.test-utils.tsx`
- Modify: current conversation files already changed in the optional-practice worktree

**Interfaces:**
- Produces: two reviewable commits that can be merged without stashing or copying untracked assets

- [ ] Verify branch tracking and remote ancestry after `git fetch origin`.
- [ ] Stage only the journey implementation/tests in the main checkout and commit them.
- [ ] Stage the current conversation implementation/tests and this plan in the optional-practice worktree and commit them.

### Task 2: Merge the change sets

**Files:**
- Modify: `apps/mobile/src/features/journey/application/journey-navigation.ts`
- Modify: `apps/mobile/src/features/journey/ui/JourneyRouteScreen.tsx`
- Modify: `apps/mobile/src/features/journey/ui/JourneyScreenShell.tsx`
- Modify: `apps/mobile/src/features/journey/ui/pages/PresetPracticePage.tsx`
- Modify: their matching Jest tests and production wiring test

**Interfaces:**
- Consumes: both checkpoint commits from Task 1
- Produces: one local integrated branch with both feature sets

- [ ] Merge `codex/six-screen-latest-main` into `codex/optional-practice-after-draft`.
- [ ] Resolve overlapping files by retaining both route-flow changes and internal step-back behavior.
- [ ] Run `git diff --check` and inspect the final staged merge.
- [ ] Commit the resolved merge.

### Task 3: Verify the integrated mobile application

**Files:**
- Test: journey, screen-shell, optional-practice, reflection, behavior-map, and production-wiring Jest suites

**Interfaces:**
- Consumes: merged implementation from Task 2
- Produces: test, type, and lint evidence for the integrated branch

- [ ] Run focused Jest suites covering all overlapping files.
- [ ] Run the full mobile Jest suite with `npm test --workspace @cave/mobile`.
- [ ] Run `npm run typecheck --workspace @cave/mobile`.
- [ ] Run `npm run lint --workspace @cave/mobile`.
- [ ] Push `codex/optional-practice-after-draft` and open a PR against `main`.
- [ ] Verify PR checks and merge the PR into remote `main` when green.
- [ ] Fetch the merged remote state and report the final commit ancestry.

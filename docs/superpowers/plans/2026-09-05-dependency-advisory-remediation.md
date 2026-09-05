# Dependency Advisory Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the two moderate production dependency advisories without weakening audit policy, and re-verify the existing root-cause patches for the two high-severity `image-size` advisories.

**Architecture:** Keep Expo SDK 57 and React Native 0.86 on their supported versions. Resolve the compatible transitive leaves with exact pnpm overrides, retain the existing narrowly scoped `image-size` patch plus its two exact GHSA exemptions because upstream still has no patched release, and prove both runtime and build-time compatibility with focused tests before running the repository gates.

**Tech Stack:** pnpm 10.34.5, Node 22.23.2, Expo SDK 57, React Native 0.86, Vitest, Jest.

---

### Task 1: Add failing dependency-policy tests

**Files:**
- Modify: `tests/security-config.test.ts`

- [ ] Add assertions that `pnpm-workspace.yaml` pins `decode-uri-component` to `0.5.0` and `uuid` to `11.1.1`, while preserving only the two existing `image-size` GHSA exemptions.
- [ ] Run `pnpm vitest run --root tests security-config.test.ts` and confirm it fails because the two overrides are absent.

### Task 2: Add failing compatibility tests

**Files:**
- Create: `tests/dependency-advisory-compatibility.test.ts`

- [ ] Test the installed `decode-uri-component` version and run a malformed percent-encoded input under a one-second child-process timeout.
- [ ] Test the installed `uuid` version and invoke the real `xcode` package's `generateUuid()` method, proving its CommonJS `uuid.v4()` call remains compatible.
- [ ] Run `pnpm vitest run --root tests dependency-advisory-compatibility.test.ts` and confirm the version assertions fail against `0.2.2` and `7.0.3`.

### Task 3: Apply minimal dependency overrides

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `pnpm-lock.yaml`
- Create: `patches/decode-uri-component@0.5.0.patch`

- [ ] Add exact overrides `decode-uri-component: "0.5.0"` and `uuid: "11.1.1"` without changing the two existing GHSA exemptions.
- [ ] Patch only the safe decoder's module wrapper so `query-string@7.1.3` and Jest 29 can consume it as CommonJS without changing the fixed decoding algorithm.
- [ ] Run `pnpm install --lockfile-only` with Node 22.23.2, inspect the lockfile diff, then run frozen install.
- [ ] Re-run both focused test files and confirm they pass.

### Task 4: Verify audit and repository gates

**Files:**
- Verify: `pnpm-lock.yaml`
- Verify: `outputs/p0-readiness/verification.json` (generated and ignored)

- [ ] Run the real `pnpm security:audit` and record the advisory count and severities.
- [ ] Run `pnpm test:ci-config`, `pnpm --filter @cave/mobile test`, and `pnpm typecheck`.
- [ ] Run `pnpm verify:internal`, then `git diff --check` and inspect `git status --short`.
- [ ] Report eliminated advisories, the patched-but-upstream-unfixed `image-size` maintenance risk, and exact command evidence. Do not push, create a PR, or merge.

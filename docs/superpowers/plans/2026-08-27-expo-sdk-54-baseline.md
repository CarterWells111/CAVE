# Expo SDK 54 Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CAVE's active Expo SDK 57 baseline with a fully aligned Expo SDK 54 mobile stack and update every active repository constraint and acceptance record accordingly.

**Architecture:** Keep the current pnpm monorepo, CAVE identity, EAS project, Worker, and shared domain packages intact. Align only the Expo-managed mobile dependency matrix through the official Expo installer, lock the decision with focused regression tests, then re-run all Plan 01/02 gates and a real Expo Go check.

**Tech Stack:** Expo SDK 54, React Native 0.81, React 19.1, Expo Router 6, TypeScript, pnpm 10, Jest/Vitest, Cloudflare Workers, GitHub Actions

---

## File Map

- Create `apps/mobile/src/config/sdk-baseline.test.ts`: locks the executable mobile dependency baseline.
- Create `tests/sdk-baseline-docs.test.ts`: locks the active README and plan headers to SDK 54 and requires an explicit SDK 57 supersession record.
- Modify `apps/mobile/package.json`: Expo-managed SDK 54 dependency ranges only; preserve package name and app version.
- Modify `pnpm-lock.yaml`: resolved pnpm graph for the SDK 54 package manifest.
- Modify `README.md`: active fixed technology decision.
- Modify `docs/superpowers/plans/2026-08-26-00-hackathon-master-roadmap.md`: top-level stack, superseding decision, and real verification evidence.
- Modify `docs/superpowers/plans/2026-08-26-01-repository-infrastructure-ios-build.md`: Plan 01 SDK baseline and dependency-repair instruction.
- Modify `docs/superpowers/plans/2026-08-26-05-mobile-mvp-integration.md`: forward-looking mobile implementation stack.
- Modify `docs/superpowers/plans/2026-08-27-cave-product-identity-migration.md`: active stack and Expo Go acceptance path.
- Modify `docs/superpowers/specs/2026-08-27-expo-sdk-54-baseline-design.md`: retain the approved design and corrected GREEN commit boundary.

### Task 1: Lock the executable SDK 54 dependency baseline

**Files:**
- Create: `apps/mobile/src/config/sdk-baseline.test.ts`
- Modify: `apps/mobile/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Stop the verified CAVE Metro process and remove only its generated artifacts**

Resolve the process listening on port 8082. Stop it only if its command line contains both the current CAVE worktree and `expo`/`start`. Then restore `apps/mobile/expo-env.d.ts` and remove only the untracked generated `apps/mobile/.gitignore`.

```powershell
$listener = Get-NetTCPConnection -LocalPort 8082 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
  if ($process.CommandLine -notlike '*033b*内界 CAVE*expo*start*') { throw "Unexpected port 8082 owner: $($process.CommandLine)" }
  Stop-Process -Id $process.ProcessId -Force
}
git restore --worktree -- apps/mobile/expo-env.d.ts
if (Test-Path -LiteralPath 'apps/mobile/.gitignore') { Remove-Item -LiteralPath 'apps/mobile/.gitignore' }
git status --short
```

Expected: no app runtime artifact remains; only the already committed plan/design state is present.

- [ ] **Step 2: Write the failing SDK baseline test**

Create `apps/mobile/src/config/sdk-baseline.test.ts`:

```ts
import packageJson from "../../package.json";

describe("Expo SDK baseline", () => {
  it("uses the approved SDK 54 dependency matrix", () => {
    expect(packageJson.dependencies.expo).toMatch(/^~54\./u);
    expect(packageJson.dependencies.react).toBe("19.1.0");
    expect(packageJson.dependencies["react-native"]).toMatch(/^0\.81\./u);
    expect(packageJson.dependencies["expo-router"]).toMatch(/^~6\./u);
    expect(packageJson.devDependencies["jest-expo"]).toMatch(/^~54\./u);
  });
});
```

- [ ] **Step 3: Run the focused test and verify RED**

```powershell
corepack pnpm --filter @cave/mobile test -- sdk-baseline.test.ts
```

Expected: exit 1; the first mismatch reports the current `~57.0.17` Expo dependency instead of a range beginning with `~54.`. A syntax, import, or Jest configuration error is not an acceptable RED result.

- [ ] **Step 4: Install Expo SDK 54 and align all Expo-managed packages**

From `apps/mobile`, run the official Expo installer in two steps so the second command executes under the SDK 54 CLI:

```powershell
npx expo install expo@~54.0.0
npx expo install --fix
```

Expected package families after alignment: the Expo range begins with `~54.`, the Expo Router range begins with `~6.`, React is exactly `19.1.0`, the React Native version begins with `0.81.`, and the Jest Expo range begins with `~54.`.

Do not hand-select patch versions before Expo's installer reports its target matrix. Preserve `@cave/contracts`, package name `@cave/mobile`, version `0.1.0`, scripts, and Jest preset.

- [ ] **Step 5: Verify the dependency GREEN state**

From the repository root:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @cave/mobile test -- sdk-baseline.test.ts
corepack pnpm --filter @cave/mobile expo:doctor
corepack pnpm --filter @cave/mobile test
corepack pnpm --filter @cave/mobile typecheck
corepack pnpm --filter @cave/mobile lint
```

Expected: every command exits 0; the focused test is GREEN; Expo Doctor reports every check passing; all existing mobile suites still pass.

- [ ] **Step 6: Confirm no native project was generated and commit the GREEN change**

```powershell
if (Test-Path -LiteralPath 'apps/mobile/ios') { throw 'Unexpected generated iOS directory' }
if (Test-Path -LiteralPath 'apps/mobile/android') { throw 'Unexpected generated Android directory' }
git diff --check
git add apps/mobile/package.json apps/mobile/src/config/sdk-baseline.test.ts pnpm-lock.yaml
git commit -m "chore: align mobile with expo sdk 54"
```

Expected: one commit containing the test, package manifest, and lockfile; no native directory and no unrelated file.

### Task 2: Migrate every active SDK constraint and record

**Files:**
- Create: `tests/sdk-baseline-docs.test.ts`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-08-26-00-hackathon-master-roadmap.md`
- Modify: `docs/superpowers/plans/2026-08-26-01-repository-infrastructure-ios-build.md`
- Modify: `docs/superpowers/plans/2026-08-26-05-mobile-mvp-integration.md`
- Modify: `docs/superpowers/plans/2026-08-27-cave-product-identity-migration.md`
- Modify: `docs/superpowers/specs/2026-08-27-expo-sdk-54-baseline-design.md`

- [ ] **Step 1: Write the failing active-document baseline test**

Create `tests/sdk-baseline-docs.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));
const activeDocuments = [
  "README.md",
  "docs/superpowers/plans/2026-08-26-00-hackathon-master-roadmap.md",
  "docs/superpowers/plans/2026-08-26-01-repository-infrastructure-ios-build.md",
  "docs/superpowers/plans/2026-08-26-05-mobile-mvp-integration.md",
  "docs/superpowers/plans/2026-08-27-cave-product-identity-migration.md"
];

function read(path: string) {
  return readFileSync(resolve(workspaceRoot, path), "utf8");
}

describe("active Expo SDK documentation", () => {
  it.each(activeDocuments)("declares SDK 54 near the top of %s", (path) => {
    const activeHeader = read(path).split(/\r?\n/u).slice(0, 30).join("\n");

    expect(activeHeader).toContain("Expo SDK 54");
    expect(activeHeader).not.toContain("Expo SDK 57");
  });

  it("records that the SDK 54 decision supersedes the SDK 57 attempt", () => {
    expect(
      read("docs/superpowers/plans/2026-08-26-00-hackathon-master-roadmap.md")
    ).toContain("SDK 57 baseline was superseded by the user-authorized Expo SDK 54 decision");
  });
});
```

- [ ] **Step 2: Run the documentation test and verify RED**

```powershell
corepack pnpm test:ci-config -- sdk-baseline-docs.test.ts
```

Expected: exit 1 because the active headers still declare SDK 57 and the explicit supersession sentence does not exist.

- [ ] **Step 3: Update active documentation to the approved SDK 54 baseline**

Apply these exact semantic changes:

- `README.md`: change the fixed decision to `Expo SDK 54 + pnpm workspace`.
- Master roadmap: change the top-level Tech Stack to SDK 54; preserve the observed SDK 57 failure; add the sentence `SDK 57 baseline was superseded by the user-authorized Expo SDK 54 decision`; replace the `sign.expo.dev` next action with Apple App Store Expo Go 54 acceptance.
- Plan 01: change Tech Stack and dependency-conflict recovery from SDK 57 to SDK 54.
- Plan 05: change its mobile Tech Stack from SDK 57 to SDK 54.
- Identity migration plan: change the active Tech Stack to SDK 54; replace the physical-iPhone SDK 57 signing flow with the App Store Expo Go 54 flow; retain the rule that Expo Go cannot satisfy the signed Development Build gate.
- Approved design: retain the historical SDK 57 context and the corrected GREEN commit boundary.

Do not edit immutable commit hashes or rewrite the first-attempt observation as a success.

- [ ] **Step 4: Verify documentation GREEN and active-reference consistency**

```powershell
corepack pnpm test:ci-config -- sdk-baseline-docs.test.ts
rg -n --hidden --glob '!node_modules/**' --glob '!.git/**' --glob '!pnpm-lock.yaml' 'Expo SDK 57|SDK 57 baseline|57\.0\.' README.md apps docs
git diff --check
```

Expected: the test exits 0. Remaining `SDK 57` matches exist only in the approved design, the historical attempt, and the explicit supersession statement; active headers and instructions use SDK 54. Package source contains no `57.0.x` dependency.

- [ ] **Step 5: Commit the documentation GREEN change**

```powershell
git add README.md tests/sdk-baseline-docs.test.ts docs/superpowers/plans/2026-08-26-00-hackathon-master-roadmap.md docs/superpowers/plans/2026-08-26-01-repository-infrastructure-ios-build.md docs/superpowers/plans/2026-08-26-05-mobile-mvp-integration.md docs/superpowers/plans/2026-08-27-cave-product-identity-migration.md docs/superpowers/specs/2026-08-27-expo-sdk-54-baseline-design.md
git commit -m "docs: adopt expo sdk 54 baseline"
```

Expected: documentation and its regression test are committed together after GREEN.

### Task 3: Re-run Plan 01/02 software gates

**Files:**
- Modify only if a verified SDK 54 compatibility failure requires a minimal fix.

- [ ] **Step 1: Run the complete local Gate 01A command set freshly**

```powershell
corepack pnpm -r list --depth -1
corepack pnpm verify:foundation
corepack pnpm --filter @cave/mobile expo:doctor
corepack pnpm --filter @cave/gateway test
corepack pnpm --filter @cave/gateway build
git diff --check
git status --short
```

Expected: every command exits 0. Record workspace count, mobile/total test counts, Doctor check count, and Wrangler bundle size from the real output.

- [ ] **Step 2: Re-run Gate 02A and 02B freshly**

```powershell
corepack pnpm test:contracts
corepack pnpm test:content
corepack pnpm --filter @cave/scenario-engine test
corepack pnpm --filter @cave/test-fixtures test
corepack pnpm validate:content:draft
corepack pnpm validate:content
```

Expected: all commands exit 0; both draft and production content validation pass; Gate 02A and Gate 02B remain `pass`.

- [ ] **Step 3: Apply at most two root-cause-based compatibility repairs if required**

For any failure, record the exact command and first causal error. Use Expo's target matrix via `npx expo install --fix` for dependency mismatches. Limit automated repair to `apps/mobile/package.json` and `pnpm-lock.yaml`; if source code or a non-mobile package appears to require a change, stop that repair path and document the exact incompatibility for review. Do not skip tests, weaken TypeScript, generate native directories, or change backend/domain versions without a direct failing dependency edge.

- [ ] **Step 4: Commit only a required compatibility repair**

If Step 3 changes the mobile dependency manifest and lockfile, re-run the exact failing command plus `corepack pnpm verify:foundation`, then commit only those files:

```powershell
git add apps/mobile/package.json pnpm-lock.yaml
git commit -m "fix: restore expo sdk 54 compatibility"
```

If no repair is required, do not create an empty commit.

### Task 4: Start Expo Go 54 and obtain real-device supplemental evidence

**Files:**
- Modify: `docs/superpowers/plans/2026-08-26-00-hackathon-master-roadmap.md`

- [ ] **Step 1: Start a network-authorized Expo Go server without changing the dev-client script**

From `apps/mobile`:

```powershell
.\node_modules\.bin\expo.CMD start --go --lan --port 8082
```

Expected: the CLI reports `Using Expo Go`, shows a QR code, and publishes the hotspot address `exp://172.20.10.3:8082` or the currently observed LAN address. If port ownership differs, resolve it before choosing another port.

- [ ] **Step 2: Verify manifest, bundle, identity, and SDK before asking for device observation**

Request the manifest with `Expo-Platform: ios` and `Accept: application/expo+json,application/json`. Require HTTP 200, `runtimeVersion: exposdk:54.0.0`, project ID `1ddc0761-af43-491c-b969-ec2f6c415013`, slug `cave`, and version `0.1.0`. Request the returned launch asset URL and require HTTP 200.

- [ ] **Step 3: Observe the real iPhone in Apple App Store Expo Go**

Open the new QR code on the intended iPhone. Record, without inference:

- device model and iOS version supplied by the user;
- absence or presence of the SDK mismatch screen;
- absence or presence of a red runtime error;
- displayed product name, slogan, version, build, and environment.

Expo Go success remains supplemental. Do not mark Gate 01B `pass` because Development Build signing, installation, and two Metro-disconnected launches are still outstanding.

- [ ] **Step 4: Record the observed SDK 54 evidence and commit**

Update the master roadmap with the exact command results, manifest/bundle results, Expo Go observation, unresolved Development Build items, dependency commit, documentation commit, and current CI URL. Then:

```powershell
git add docs/superpowers/plans/2026-08-26-00-hackathon-master-roadmap.md
git commit -m "docs: record expo sdk 54 verification"
```

Expected: no claim exceeds observed evidence; Gate 01B remains `external_pending` until the signed build gate is completed.

### Task 5: Final branch verification and CI

**Files:**
- No additional files unless final evidence needs a truthful correction.

- [ ] **Step 1: Stop Metro and remove its generated artifacts**

Use the same verified-process check from Task 1. Restore only `apps/mobile/expo-env.d.ts` and remove only the generated `apps/mobile/.gitignore` if present.

- [ ] **Step 2: Run final verification freshly**

```powershell
corepack pnpm -r list --depth -1
corepack pnpm test:ci-config
corepack pnpm verify:foundation
corepack pnpm --filter @cave/mobile expo:doctor
corepack pnpm --filter @cave/gateway test
corepack pnpm --filter @cave/gateway build
corepack pnpm test:contracts
corepack pnpm test:content
corepack pnpm --filter @cave/scenario-engine test
corepack pnpm --filter @cave/test-fixtures test
corepack pnpm validate:content:draft
corepack pnpm validate:content
git diff --check
git status --short --branch
```

Expected: every software command exits 0, the branch contains no generated artifact, Gate 01A/02A/02B remain pass, and Gate 01B remains truthful.

- [ ] **Step 3: Push the current feature branch and watch exact-HEAD CI**

```powershell
git push
$head = git rev-parse HEAD
$run = gh run list --branch codex/plan-01-02-implementation --limit 1 --json databaseId,headSha,url | ConvertFrom-Json
if ($run.headSha -ne $head) { throw "Latest CI does not target current HEAD" }
gh run watch $run.databaseId --exit-status
git status --short --branch
```

Expected: CI exits 0 for exact HEAD; branch tracks origin; no merge to `main`.

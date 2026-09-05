# Expo SDK 57 Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `@cave/mobile` from Expo SDK 54 to the latest stable SDK 57 dependency matrix while keeping both Expo Go and EAS development-client workflows operational.

**Architecture:** Let Expo CLI resolve the SDK-coupled dependency matrix, then encode the resulting compatibility contract in the existing baseline test. Preserve Continuous Native Generation and the existing application architecture; make only compatibility changes demonstrated by diagnostics or verification failures.

**Tech Stack:** Expo SDK 57, React Native 0.86, React 19.2, Expo Router 57, pnpm workspaces, Jest, TypeScript, ESLint, EAS Build.

---

### Task 1: Turn the SDK baseline into a failing SDK 57 contract

**Files:**
- Modify: `apps/mobile/src/config/sdk-baseline.test.ts`
- Modify: `apps/mobile/package.json`

- [x] **Step 1: Update the baseline test to require SDK 57 families and the authenticated Expo Go start command**

```ts
import packageJson from "../../package.json";

describe("Expo SDK baseline", () => {
  it("uses the approved SDK 57 dependency matrix", () => {
    expect(packageJson.dependencies.expo).toBe("~57.0.20");
    expect(packageJson.dependencies.react).toBe("19.2.3");
    expect(packageJson.dependencies["react-native"]).toBe("0.86.3");
    expect(packageJson.dependencies["expo-router"]).toBe("~57.0.19");
    expect(packageJson.dependencies["expo-dev-client"]).toBe("~57.0.18");
    expect(packageJson.dependencies["expo-splash-screen"]).toBe("~57.0.8");
    expect(packageJson.dependencies["expo-system-ui"]).toBe("~57.0.3");
    expect(packageJson.dependencies["@expo/vector-icons"]).toBe("^15.1.1");
    expect(packageJson.dependencies["@expo/metro-runtime"]).toBe("~57.0.15");
    expect(packageJson.devDependencies["jest-expo"]).toBe("~57.0.5");
    expect(packageJson.scripts.start).toBe("expo start --go");
    expect(packageJson.scripts["start:dev-client"]).toBe("expo start --dev-client");
  });
});
```

- [x] **Step 2: Remove `--offline` from the Expo Go start script**

```json
"start": "expo start --go"
```

- [x] **Step 3: Run the focused test and confirm the dependency assertions fail against SDK 54**

Run from `apps/mobile`:

```powershell
& 'C:\Users\carte\AppData\Local\nvm\v24.15.0\corepack.cmd' pnpm test -- src/config/sdk-baseline.test.ts
```

Expected: FAIL because the SDK-coupled dependencies still resolve to SDK 54 versions; the start-script assertion passes.

### Task 2: Resolve and install the supported SDK 57 dependency matrix

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `pnpm-lock.yaml`

- [x] **Step 1: Upgrade Expo to the latest stable SDK 57 patch**

Run from `apps/mobile`:

```powershell
& 'C:\Users\carte\AppData\Local\nvm\v24.15.0\corepack.cmd' pnpm exec expo install expo@latest
```

Expected: `apps/mobile/package.json` changes from `expo ~54.0.37` to `expo ~57.0.20` and pnpm refreshes the lockfile.

- [x] **Step 2: Let Expo align every SDK-coupled package**

```powershell
& 'C:\Users\carte\AppData\Local\nvm\v24.15.0\corepack.cmd' pnpm exec expo install --fix
```

Expected: React becomes `19.2.3`, React Native becomes `0.86.3`, Expo Router becomes `~57.0.19`, Expo native modules move to the versions published in Expo 57.0.20's `bundledNativeModules.json`, and `expo-dev-client` remains installed at `~57.0.18`.

- [x] **Step 3: Confirm the manifest contains no SDK 54 declarations**

```powershell
rg -n '54\.0|0\.81\.5|19\.1\.0' package.json
```

Expected: no matches in `apps/mobile/package.json`.

### Task 3: Pin the resolved SDK 57 compatibility contract

**Files:**
- Verify: `apps/mobile/package.json`
- Verify: `apps/mobile/src/config/sdk-baseline.test.ts`

- [x] **Step 1: Confirm the installed manifest matches the exact baseline written in Task 1**

Run from `apps/mobile`:

```powershell
Get-Content -LiteralPath 'package.json' -Raw
```

Expected core matrix: Expo `~57.0.20`, React `19.2.3`, React Native `0.86.3`, Expo Router `~57.0.19`, Expo dev client `~57.0.18`, splash screen `~57.0.8`, system UI `~57.0.3`, the already-compatible vector icons range `^15.1.1`, metro runtime `~57.0.15`, and Jest Expo `~57.0.5`.

- [x] **Step 2: Run the focused baseline test**

```powershell
& 'C:\Users\carte\AppData\Local\nvm\v24.15.0\corepack.cmd' pnpm test -- src/config/sdk-baseline.test.ts
```

Expected: PASS with one suite and one test passing.

- [x] **Step 3: Run Expo dependency validation**

```powershell
& 'C:\Users\carte\AppData\Local\nvm\v24.15.0\corepack.cmd' pnpm exec expo install --check
& 'C:\Users\carte\AppData\Local\nvm\v24.15.0\corepack.cmd' pnpm expo:doctor
```

Expected: dependencies are current and Expo Doctor reports all checks passing.

### Task 4: Repair only demonstrated SDK 57 compatibility regressions

**Files:**
- Modify only files named by TypeScript, Jest, ESLint, Expo Doctor, or export failures.

- [x] **Step 1: Run mobile type checking**

```powershell
& 'C:\Users\carte\AppData\Local\nvm\v24.15.0\corepack.cmd' pnpm typecheck
```

Expected: PASS. If SDK 57 type changes produce errors, update only reported API usages and add or update focused tests before production changes.

- [x] **Step 2: Run the mobile test suite**

```powershell
& 'C:\Users\carte\AppData\Local\nvm\v24.15.0\corepack.cmd' pnpm test
```

Expected: all mobile suites pass.

- [x] **Step 3: Run mobile lint**

```powershell
& 'C:\Users\carte\AppData\Local\nvm\v24.15.0\corepack.cmd' pnpm lint
```

Expected: no lint errors.

### Task 5: Verify the upgraded workspace end to end

**Files:**
- Verify only; do not create native `ios/` or `android/` directories.

- [x] **Step 1: Run repository-wide type checking, lint, and tests**

Run from the worktree root:

```powershell
& 'C:\Users\carte\AppData\Local\nvm\v24.15.0\corepack.cmd' pnpm typecheck
& 'C:\Users\carte\AppData\Local\nvm\v24.15.0\corepack.cmd' pnpm lint
& 'C:\Users\carte\AppData\Local\nvm\v24.15.0\corepack.cmd' pnpm test
```

Expected: every workspace package passes.

- [x] **Step 2: Run mobile source-policy verification**

```powershell
& 'C:\Users\carte\AppData\Local\nvm\v24.15.0\corepack.cmd' pnpm verify:mobile-policy
```

Expected: policy verification passes.

- [x] **Step 3: Export the iOS JavaScript bundle with SDK 57**

```powershell
& 'C:\Users\carte\AppData\Local\nvm\v24.15.0\corepack.cmd' pnpm --filter @cave/mobile export:ios
```

Expected: Expo creates the iOS bundle in `apps/mobile/dist` without bundling or configuration errors.

- [x] **Step 4: Inspect final local changes**

```powershell
git status --short
git diff --check
git diff -- apps/mobile/package.json apps/mobile/src/config/sdk-baseline.test.ts pnpm-lock.yaml
```

Expected: SDK 57 manifest, lockfile, baseline-test, and authenticated start-script changes are present; existing journey-map changes are preserved; `git diff --check` succeeds. Do not commit or push.

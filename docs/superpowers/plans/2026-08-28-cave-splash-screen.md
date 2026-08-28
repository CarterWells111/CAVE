# 内界 CAVE Splash Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the CAVE logo on a `#1B0D1F` launch background in Expo Go's development preview and in future native iOS preview/production builds.

**Architecture:** Keep the iOS launcher icon scoped to `ios.icon`, add the SDK 54-compatible `expo-splash-screen` config plugin, and give the plugin an exact transparent copy of the approved logo. All EAS profiles share one immutable plugin tuple; contract tests guard the visual settings and ensure no top-level or Android launcher icon is introduced.

**Tech Stack:** Expo SDK 54, `expo-splash-screen` `~31.0.13`, TypeScript, Jest, PNG, pnpm

---

## File map

- Create `apps/mobile/assets/splash-icon.png`: exact transparent copy of the approved source logo.
- Modify `apps/mobile/app.config.ts`: add the shared splash-screen plugin configuration.
- Modify `apps/mobile/src/config/app-identity.test.ts`: protect the three-profile splash tuple and iOS-only icon scope.
- Modify `apps/mobile/src/config/sdk-baseline.test.ts`: protect the SDK 54 splash dependency version.
- Modify `apps/mobile/package.json`: add `expo-splash-screen` as a direct dependency.
- Modify `pnpm-lock.yaml`: lock the workspace dependency graph.

### Task 1: Lock the splash-screen contract

**Files:**
- Modify: `apps/mobile/src/config/app-identity.test.ts`
- Modify: `apps/mobile/src/config/sdk-baseline.test.ts`
- Test: `apps/mobile/src/config/app-identity.test.ts`
- Test: `apps/mobile/src/config/sdk-baseline.test.ts`

- [ ] **Step 1: Add the failing profile contract**

Add this test inside `describe("Expo app identity", ...)`:

```ts
test.each(["development", "preview", "production"])(
  "uses the shared branded splash screen for the %s profile",
  (profile) => {
    expect(configFor(profile).plugins).toContainEqual([
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#1B0D1F"
      }
    ]);
  }
);
```

Keep the existing profile assertions that require `config.icon` and `config.android` to remain undefined and `config.ios?.icon` to remain `./assets/app-icon.png`.

- [ ] **Step 2: Lock the SDK-compatible dependency**

Add this assertion to the existing dependency test in `apps/mobile/src/config/sdk-baseline.test.ts`:

```ts
expect(packageJson.dependencies["expo-splash-screen"]).toBe("~31.0.13");
```

- [ ] **Step 3: Run the focused tests and verify RED**

```powershell
corepack pnpm --filter @cave/mobile test -- app-identity.test.ts sdk-baseline.test.ts
```

Expected: the three splash-profile cases fail because the plugin tuple is missing, and the dependency assertion fails because `expo-splash-screen` is not a direct dependency. Existing icon/profile assertions remain green.

### Task 2: Add the transparent splash asset and plugin

**Files:**
- Create: `apps/mobile/assets/splash-icon.png`
- Modify: `apps/mobile/app.config.ts`
- Modify: `apps/mobile/package.json`
- Modify: `pnpm-lock.yaml`
- Test: `apps/mobile/src/config/app-identity.test.ts`
- Test: `apps/mobile/src/config/sdk-baseline.test.ts`

- [ ] **Step 1: Preserve the exact transparent source**

Copy `C:\Users\carte\Desktop\shenicest\logo.png` to `apps/mobile/assets/splash-icon.png` without re-encoding. Compare SHA-256 hashes and require both to equal:

```text
EB46D26357D1FBA99AB723C80D1510E31F29B0C4BC1B3FFE96E1B9CCB594F2BD
```

Use `System.Drawing.Bitmap` to verify the asset is 1254×1254 and contains transparent corner pixels.

- [ ] **Step 2: Install the Expo SDK 54 dependency**

```powershell
corepack pnpm --filter @cave/mobile add expo-splash-screen@~31.0.13
```

Expected: `apps/mobile/package.json` gains `"expo-splash-screen": "~31.0.13"`; `pnpm-lock.yaml` records the importer and resolved package without changing unrelated dependency versions.

- [ ] **Step 3: Configure the shared splash plugin**

Insert this tuple in `apps/mobile/app.config.ts` after `"expo-system-ui"`:

```ts
[
  "expo-splash-screen",
  {
    image: "./assets/splash-icon.png",
    imageWidth: 200,
    resizeMode: "contain",
    backgroundColor: "#1B0D1F"
  }
],
```

Do not add a top-level `icon`, `android.icon`, `android.adaptiveIcon`, legacy `splash` field, animation, or runtime loading component.

- [ ] **Step 4: Run the focused tests and verify GREEN**

```powershell
corepack pnpm --filter @cave/mobile test -- app-identity.test.ts sdk-baseline.test.ts
```

Expected: both suites pass, including the three splash profiles, the iOS-only icon scope, and the exact dependency version.

- [ ] **Step 5: Verify resolved Expo configuration**

From `apps/mobile`, run the local Expo CLI for development, preview, and production and parse `config --type public --json`. Require the splash plugin tuple to match exactly, `ios.icon` to remain `./assets/app-icon.png`, and top-level/Android launcher icon fields to remain absent.

- [ ] **Step 6: Run compatibility checks**

```powershell
corepack pnpm --filter @cave/mobile typecheck
corepack pnpm --filter @cave/mobile expo:doctor
```

Expected: both commands exit 0. If the current dirty working tree contains unrelated TypeScript failures, repeat typecheck from a clean detached snapshot of the splash commit rather than altering those files.

- [ ] **Step 7: Commit only the splash-screen change**

```powershell
git add -- apps/mobile/assets/splash-icon.png apps/mobile/app.config.ts apps/mobile/src/config/app-identity.test.ts apps/mobile/src/config/sdk-baseline.test.ts apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat(mobile): add branded splash screen"
```

Before committing, confirm none of the user's current navigation, Metro, storage, `expo-env`, or `.gitignore` changes are staged.

### Task 3: Final launch-screen verification

**Files:**
- Verify: `apps/mobile/assets/splash-icon.png`
- Verify: `apps/mobile/app.config.ts`
- Verify: `apps/mobile/package.json`
- Verify: `pnpm-lock.yaml`

- [ ] **Step 1: Re-run the focused contract and dependency checks**

```powershell
corepack pnpm --filter @cave/mobile test -- app-identity.test.ts sdk-baseline.test.ts
```

Expected: all focused tests pass with zero failures.

- [ ] **Step 2: Audit asset and configuration scope**

Verify the splash asset SHA-256 and transparency again. Parse all three public configs and confirm the splash tuple, 200px width, `contain`, `#1B0D1F`, `ios.icon`, and absent top-level/Android launcher icons.

- [ ] **Step 3: Verify the final diff**

Run `git diff --check` against the parent commit and inspect `git status --short`. The splash commit must contain exactly the six planned paths, while all unrelated user changes remain outside the commit.

- [ ] **Step 4: Runtime observation guidance**

Restart Metro and reopen the project in Expo Go to observe the development-only splash simulation. Treat a preview or production iOS build as the acceptance environment for the real native launch screen, following Expo's documented limitation.


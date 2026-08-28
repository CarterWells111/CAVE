# 内界 CAVE App Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use the supplied CAVE logo for every iOS build profile and for the production website favicon, while leaving Android unconfigured.

**Architecture:** Preserve the supplied transparent PNG as the brand source and deterministically composite it over `#1B0D1F`. The mobile branch owns a 1024×1024 opaque app icon referenced from the shared Expo config; the clean `main` website worktree owns a 64×64 PNG favicon referenced by every static route. Contract tests fail before each configuration change and guard the final asset paths and dimensions.

**Tech Stack:** Expo SDK 54, TypeScript, Jest, Astro 7, Vitest 4, PNG, PowerShell `System.Drawing`

---

## File map

- Create `assets/brand/logo.png`: untouched transparent source copied from the user-provided image.
- Create `apps/mobile/assets/app-icon.png`: 1024×1024 opaque iOS icon on `#1B0D1F`.
- Modify `apps/mobile/app.config.ts`: shared Expo `icon` used by development, preview, and production.
- Modify `apps/mobile/src/config/app-identity.test.ts`: profile-level icon and Android-scope contract.
- In `.worktrees/site-main-publish`, create `assets/brand/logo.png`: the same canonical source on `main`.
- In `.worktrees/site-main-publish`, create `apps/web/public/favicon.png`: 64×64 website favicon derived from the iOS icon.
- In `.worktrees/site-main-publish`, delete `apps/web/public/favicon.svg`: obsolete favicon.
- In `.worktrees/site-main-publish`, modify `apps/web/src/layouts/BaseLayout.astro`: PNG favicon reference.
- In `.worktrees/site-main-publish`, modify `apps/web/tests/routes.test.ts`: route-level favicon contract.
- In `.worktrees/site-main-publish`, modify `apps/web/tests/static-controls.test.ts`: built artifact PNG signature and dimensions.

### Task 1: Lock the Expo icon contract

**Files:**
- Modify: `apps/mobile/src/config/app-identity.test.ts`
- Test: `apps/mobile/src/config/app-identity.test.ts`

- [ ] **Step 1: Write the failing profile contract**

Add this test inside `describe("Expo app identity", ...)`:

```ts
test.each(["development", "preview", "production"])(
  "uses the shared iOS icon for the %s profile",
  (profile) => {
    const config = configFor(profile);

    expect(config.icon).toBe("./assets/app-icon.png");
    expect(config.android).toBeUndefined();
  }
);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
corepack pnpm --filter @cave/mobile test -- app-identity.test.ts
```

Expected: FAIL three times because `config.icon` is `undefined`, while the Android assertion remains green.

### Task 2: Generate and configure the iOS icon

**Files:**
- Create: `assets/brand/logo.png`
- Create: `apps/mobile/assets/app-icon.png`
- Modify: `apps/mobile/app.config.ts`
- Test: `apps/mobile/src/config/app-identity.test.ts`

- [ ] **Step 1: Preserve the exact source image**

Copy `C:\Users\carte\Desktop\shenicest\logo.png` to `assets/brand/logo.png` without re-encoding it, then compare SHA-256 hashes with `Get-FileHash`. The hashes must match exactly.

- [ ] **Step 2: Deterministically create the opaque 1024×1024 PNG**

Use `System.Drawing` to create a 1024×1024 32-bit ARGB bitmap, clear it to RGB `(27, 13, 31)`, draw the full 1254×1254 source canvas into the full destination canvas with high-quality bicubic interpolation, and save it as `apps/mobile/assets/app-icon.png`. Do not add rounded corners, padding, text, borders, shadows, or glow.

- [ ] **Step 3: Add the shared Expo icon**

Add this property alongside the existing common identity fields in `apps/mobile/app.config.ts`:

```ts
icon: "./assets/app-icon.png",
```

Do not add an `android` block.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
corepack pnpm --filter @cave/mobile test -- app-identity.test.ts
```

Expected: PASS for every display-name, shared-identity, project-ID, icon-path, and Android-scope assertion.

- [ ] **Step 5: Verify the binary asset**

Use `System.Drawing.Bitmap` to assert width `1024`, height `1024`, alpha `255` for every pixel, and corner RGB values `(27, 13, 31)`. Then run:

```powershell
corepack pnpm --filter @cave/mobile exec expo config --type public
corepack pnpm --filter @cave/mobile typecheck
```

Expected: Expo prints `icon: ./assets/app-icon.png`, no Android configuration appears, and TypeScript exits 0.

- [ ] **Step 6: Commit only the mobile icon change**

```powershell
git add -- assets/brand/logo.png apps/mobile/assets/app-icon.png apps/mobile/app.config.ts apps/mobile/src/config/app-identity.test.ts
git commit -m "feat(mobile): apply CAVE app icon"
```

### Task 3: Lock the website favicon contract on main

Run this task from `C:\Users\carte\Documents\ChatGPT\内界 CAVE\.worktrees\site-main-publish`.

**Files:**
- Modify: `apps/web/tests/routes.test.ts`
- Modify: `apps/web/tests/static-controls.test.ts`

- [ ] **Step 1: Change the route expectation to PNG**

In `routes.test.ts`, replace the favicon assertion with:

```ts
expect(tags(html, "link").filter((tag) => (
  attribute(tag, "rel") === "icon" &&
  attribute(tag, "href") === "/favicon.png" &&
  attribute(tag, "type") === "image/png"
))).toHaveLength(1);
```

- [ ] **Step 2: Change the static asset expectation to a 64×64 PNG**

In `static-controls.test.ts`, remove the SVG literal and SVG safety helpers. Add:

```ts
const assertFaviconControls = (source: Buffer) => {
  expect(source.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  );
  expect(source.readUInt32BE(16)).toBe(64);
  expect(source.readUInt32BE(20)).toBe(64);
};
```

Read `favicon.png` without an encoding:

```ts
const readDistFile = (name: string) =>
  readFile(new URL(`../dist/${name}`, import.meta.url));
```

Decode `_headers`, `robots.txt`, and `sitemap.xml` with `.toString("utf8")`, and pass the favicon buffer directly to `assertFaviconControls`.

- [ ] **Step 3: Run the website test and verify RED**

Run:

```powershell
corepack pnpm --filter @cave/web test
```

Expected: FAIL because rendered routes still reference `/favicon.svg` and the build does not contain `favicon.png`.

### Task 4: Apply the website favicon on main

Run this task from `C:\Users\carte\Documents\ChatGPT\内界 CAVE\.worktrees\site-main-publish`.

**Files:**
- Create: `assets/brand/logo.png`
- Create: `apps/web/public/favicon.png`
- Delete: `apps/web/public/favicon.svg`
- Modify: `apps/web/src/layouts/BaseLayout.astro`
- Test: `apps/web/tests/routes.test.ts`
- Test: `apps/web/tests/static-controls.test.ts`

- [ ] **Step 1: Preserve the same exact source on main**

Copy the user-provided `logo.png` to `assets/brand/logo.png` without re-encoding. Compare its SHA-256 with both the desktop source and the mobile branch copy; all hashes must match.

- [ ] **Step 2: Generate the favicon from the exact composite**

Resize the opaque 1024×1024 mobile composite to 64×64 with high-quality bicubic interpolation and save `apps/web/public/favicon.png`. Assert the output is 64×64, every pixel has alpha `255`, and all corners remain RGB `(27, 13, 31)`.

- [ ] **Step 3: Replace the HTML favicon link**

In `apps/web/src/layouts/BaseLayout.astro`, use:

```astro
<link rel="icon" href="/favicon.png" type="image/png" />
```

Delete `apps/web/public/favicon.svg` after the PNG exists.

- [ ] **Step 4: Run the website test and verify GREEN**

Run:

```powershell
corepack pnpm --filter @cave/web test
```

Expected: Astro production build succeeds and all Vitest suites pass, including the PNG path, signature, and 64×64 IHDR checks.

- [ ] **Step 5: Run website type and lint checks**

```powershell
corepack pnpm --filter @cave/web typecheck
corepack pnpm --filter @cave/web lint
```

Expected: both commands exit 0 with no errors.

- [ ] **Step 6: Commit only the website favicon change**

```powershell
git add -- assets/brand/logo.png apps/web/public/favicon.png apps/web/public/favicon.svg apps/web/src/layouts/BaseLayout.astro apps/web/tests/routes.test.ts apps/web/tests/static-controls.test.ts
git commit -m "feat(web): apply CAVE favicon"
```

### Task 5: Cross-worktree release verification

**Files:**
- Verify: `apps/mobile/app.config.ts`
- Verify: `apps/mobile/assets/app-icon.png`
- Verify: `.worktrees/site-main-publish/apps/web/public/favicon.png`

- [ ] **Step 1: Re-run the mobile release-facing checks**

```powershell
corepack pnpm --filter @cave/mobile test -- app-identity.test.ts
corepack pnpm --filter @cave/mobile exec expo config --type public
```

Expected: tests pass; public config resolves the same icon path for development, preview, and production; Android remains absent.

- [ ] **Step 2: Re-run the website production check**

From `.worktrees/site-main-publish`:

```powershell
corepack pnpm --filter @cave/web test
```

Expected: build and tests exit 0, `dist/favicon.png` exists, and no built HTML or public file references `favicon.svg`.

- [ ] **Step 3: Audit final diffs**

Run `git status --short` and scoped `git diff --check` in both worktrees. Confirm that the mobile commits exclude the user's pre-existing `expo-env`, Metro, and storage changes, and that the clean website worktree contains no unrelated changes.

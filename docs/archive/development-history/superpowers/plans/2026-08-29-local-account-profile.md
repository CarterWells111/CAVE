# Local Account Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add account-aware login entry points and locally persisted, editable nickname/avatar profiles without uploading private profile or content data.

**Architecture:** Extend the device-only auth session with the verified email, then add an account-ID-keyed SecureStore profile repository and an app-private avatar file store. A profile provider exposes one consistent view model to reusable account cards on Home, Profile, and Settings; Settings owns edit interactions while the other surfaces remain navigational/read-only.

**Tech Stack:** Expo Router, React Native, TypeScript, Expo SecureStore, Expo FileSystem, Expo ImagePicker, Jest, Testing Library.

---

### Task 1: Persist the verified email in the device session

**Files:**
- Modify: `apps/mobile/src/features/auth/infrastructure/auth-session-store.ts`
- Modify: `apps/mobile/src/features/auth/runtime/AuthProvider.tsx`
- Modify: `apps/mobile/src/features/auth/ui/EmailAuthScreen.tsx`
- Modify: `apps/mobile/app/auth/email.tsx`
- Test: `apps/mobile/src/features/auth/infrastructure/auth-session-store.test.ts`
- Test: `apps/mobile/src/features/auth/runtime/AuthProvider.test.tsx`
- Test: `apps/mobile/src/features/auth/ui/EmailAuthScreen.test.tsx`

- [ ] **Step 1: Write failing session and provider tests**

Add cases proving that `verifyEmailChallenge(challengeId, code, email)` normalizes ` Person@Example.com ` to `person@example.com`, exposes it only for signed-in/offline status, stores it beside `accountId`, retains it through token refresh, and hides it immediately after logout.

```ts
await result!.verifyEmailChallenge(challengeId, "123456", " Person@Example.com ");
expect(result?.email).toBe("person@example.com");
expect(deps.sessionStore.save).toHaveBeenLastCalledWith(expect.objectContaining({
  accountId: newAccountId,
  email: "person@example.com",
}));
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `corepack pnpm --filter @cave/mobile test -- src/features/auth/infrastructure/auth-session-store.test.ts src/features/auth/runtime/AuthProvider.test.tsx src/features/auth/ui/EmailAuthScreen.test.tsx`

Expected: FAIL because the session schema/context/verify callback do not accept or expose `email`.

- [ ] **Step 3: Implement the minimal session change**

Add a validated optional email to the stored record for backward compatibility, require the current email on new verification, and preserve the existing stored email when adopting refresh responses.

```ts
const AuthSessionRecordSchema = z.object({
  accountId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().optional(),
  refreshToken: RefreshTokenSchema,
  refreshExpiresAt: z.string().datetime({ offset: true }),
}).strict();
```

Update `EmailAuthScreen` and its route so the email already entered by the user is passed into verification; do not log it.

- [ ] **Step 4: Run the focused tests and confirm GREEN**

Run the command from Step 2. Expected: all selected tests PASS.

### Task 2: Add the account-keyed local profile repository and avatar file store

**Files:**
- Create: `apps/mobile/src/features/account/domain/account-profile.ts`
- Create: `apps/mobile/src/features/account/infrastructure/account-profile-repository.ts`
- Create: `apps/mobile/src/features/account/infrastructure/account-profile-repository.test.ts`
- Create: `apps/mobile/src/features/account/infrastructure/expo-account-profile-dependencies.ts`
- Modify: `apps/mobile/src/core/privacy/delete-all-data.ts`
- Modify: `apps/mobile/src/core/privacy/delete-all-data.test.ts`
- Modify: `apps/mobile/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Install the SDK-compatible picker**

Run: `corepack pnpm --store-dir "C:\Users\carte\AppData\Local\pnpm\store\v11\v10" --filter @cave/mobile add expo-image-picker@~17.0.10`

Expected: dependency and lockfile update only; if Expo reports another SDK 54-compatible patch, use its exact recommended version.

- [ ] **Step 2: Write failing repository tests**

Cover default profile creation, 1–24 character trimmed nickname validation, account isolation, persistence, avatar replacement/removal, corrupt-record fallback, and all-profile cleanup.

```ts
expect(await repository.load(accountA)).toEqual({
  accountId: accountA,
  displayName: "内界用户",
  avatarUri: undefined,
});
await repository.saveDisplayName(accountA, "  阿岚  ");
expect((await repository.load(accountA)).displayName).toBe("阿岚");
expect((await repository.load(accountB)).displayName).toBe("内界用户");
```

- [ ] **Step 3: Run repository/privacy tests and confirm RED**

Run: `corepack pnpm --filter @cave/mobile test -- src/features/account/infrastructure/account-profile-repository.test.ts src/core/privacy/delete-all-data.test.ts`

Expected: FAIL because the repository and profile cleanup stage do not exist.

- [ ] **Step 4: Implement profile persistence and private avatar copies**

Use one SecureStore JSON map keyed by UUID account IDs. Copy a chosen image into an `account-avatars` directory below `Paths.document`; delete the previous managed avatar only after the new copy succeeds. Expose only this interface:

```ts
type AccountProfileRepository = {
  load(accountId: string): Promise<AccountProfile>;
  saveDisplayName(accountId: string, value: string): Promise<AccountProfile>;
  replaceAvatar(accountId: string, sourceUri: string): Promise<AccountProfile>;
  removeAvatar(accountId: string): Promise<AccountProfile>;
  clearAll(): Promise<void>;
};
```

Add `delete-account-profiles` to local deletion after database files and before clearing deletion intent. Never delete an arbitrary URI: only files inside the managed avatar directory.

- [ ] **Step 5: Run repository/privacy tests and confirm GREEN**

Run the command from Step 3. Expected: all selected tests PASS.

### Task 3: Add the profile provider and reusable account card

**Files:**
- Create: `apps/mobile/src/features/account/runtime/AccountProfileProvider.tsx`
- Create: `apps/mobile/src/features/account/runtime/AccountProfileProvider.test.tsx`
- Create: `apps/mobile/src/features/account/ui/AccountProfileCard.tsx`
- Create: `apps/mobile/src/features/account/ui/AccountProfileCard.test.tsx`
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Write failing provider and component tests**

Provider cases: no profile load while auth is loading/signed out; load exact `accountId`; reset stale UI before account switch; update nickname/avatar; preserve the old value and expose a neutral retryable error on failure.

Component cases: default avatar + email-login action when signed out; nickname/email when signed in; optional avatar overlay label `点击更改`; optional accessible pencil action `更改昵称`; no edit controls in read-only mode; themed colors in light/dark.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `corepack pnpm --filter @cave/mobile test -- src/features/account/runtime/AccountProfileProvider.test.tsx src/features/account/ui/AccountProfileCard.test.tsx`

Expected: FAIL because provider/card modules do not exist.

- [ ] **Step 3: Implement minimal provider and account card**

Provider value:

```ts
type AccountProfileContextValue = {
  status: "signedOut" | "loading" | "ready" | "error";
  accountId?: string;
  email?: string;
  profile?: AccountProfile;
  saveDisplayName(value: string): Promise<void>;
  chooseAvatar(): Promise<void>;
  removeAvatar(): Promise<void>;
  retry(): void;
};
```

`chooseAvatar` requests media-library permission only after the button press, opens a square image picker with editing enabled, treats cancellation as success/no change, and passes the selected URI to the repository. Mount the provider inside `AuthProvider` and outside `JournalAccessProvider`.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run the command from Step 2. Expected: all selected tests PASS.

### Task 4: Integrate Home, Profile, and Settings

**Files:**
- Modify: `apps/mobile/src/features/shell/ui/HomeScreen.tsx`
- Modify: `apps/mobile/src/features/shell/ui/HomeScreen.test.tsx`
- Modify: `apps/mobile/app/(tabs)/index.tsx`
- Modify: `apps/mobile/src/features/shell/ui/ProfileScreen.tsx`
- Create or modify: `apps/mobile/src/features/shell/ui/ProfileScreen.test.tsx`
- Modify: `apps/mobile/app/(tabs)/profile.tsx`
- Modify: `apps/mobile/src/features/shell/ui/SettingsScreen.tsx`
- Modify: `apps/mobile/src/features/shell/ui/SettingsScreen.test.tsx`
- Modify: `apps/mobile/app/settings/index.tsx`

- [ ] **Step 1: Write failing UI/route tests**

Assert the Home CTA is `去登录，享受更多功能` only when signed out, routes to `/auth/email`, and becomes a non-promotional account entry when signed in/offline. Assert Profile places its read-only account card before `内界手记`. Assert Settings supports the avatar action sheet, restore default, nickname editor, 1–24 character validation, save failures, and no edits when signed out.

- [ ] **Step 2: Run shell tests and confirm RED**

Run: `corepack pnpm --filter @cave/mobile test -- src/features/shell/ui/HomeScreen.test.tsx src/features/shell/ui/ProfileScreen.test.tsx src/features/shell/ui/SettingsScreen.test.tsx src/features/shell/home-route.test.tsx src/features/shell/settings-route.test.tsx`

Expected: FAIL on the new account props, labels, ordering, and callbacks.

- [ ] **Step 3: Implement route and screen wiring**

Use `useAuth()` and `useAccountProfile()` in each route. Do not duplicate storage logic in screens. Settings uses React Native `Modal` for nickname editing and `Alert.alert` for `从相册选择` / `恢复默认头像` / `取消`. On successful login, Home/Profile rerender from provider state without a restart.

- [ ] **Step 4: Run shell tests and confirm GREEN**

Run the command from Step 2. Expected: all selected tests PASS.

### Task 5: Verify the complete local build

**Files:**
- Verify only: all files changed in Tasks 1–4; do not add unrelated production changes

- [ ] **Step 1: Run mobile quality gates**

Run:

```powershell
corepack pnpm --filter @cave/mobile typecheck
corepack pnpm --filter @cave/mobile lint
corepack pnpm --filter @cave/mobile test
git diff --check
```

Expected: all commands exit 0 with no new warnings from the changed account/profile code.

- [ ] **Step 2: Export the iOS bundle**

Run: `corepack pnpm --filter @cave/mobile export:ios`

Expected: Expo iOS export succeeds and includes both `expo-crypto` and `expo-image-picker` without missing-module errors.

- [ ] **Step 3: Manual Expo Go acceptance**

Verify: signed-out Home CTA; email login; account card appears immediately; nickname edit survives restart; avatar selection and restore survive restart; dark mode remains readable; logout hides identity but same-account login restores it; a different account does not see the first account's profile or journal.

- [ ] **Step 4: Preserve local-only handoff**

Do not commit, push, deploy, send email, or create remote resources. Report changed files, commands, results, and any manual checks still needing the user.

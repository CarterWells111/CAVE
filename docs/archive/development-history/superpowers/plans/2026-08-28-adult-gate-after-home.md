# Adult Gate After Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the current public brand home visible, then require a one-time local 18+ declaration before the preface or any of the six journey pages.

**Architecture:** Reuse `JourneyDraft.ageConfirmed` as the local gate state. The public welcome route remains accessible; confirming adulthood creates the initial draft, while the preface and every formal page require an adult-confirmed draft. The underage branch writes no data and renders a minimal blocking route.

**Tech Stack:** Expo Router, React Native, TypeScript, Jest, React Native Testing Library, SQLCipher-backed journey repository.

---

## File map

- `apps/mobile/src/features/journey/application/journey-application-service.ts`: persist the entry declaration without advancing to Page 2.
- `apps/mobile/src/features/journey/application/journey-navigation.ts`: require adulthood before preface/formal page prerequisites can succeed.
- `apps/mobile/app/journey/welcome.tsx`: send new journeys to the adult gate.
- `apps/mobile/app/journey/adult-gate.tsx`: remove the old post-knowledge eligibility check and route adult/underage choices.
- `apps/mobile/app/journey/underage-exit.tsx`: restore a minimal no-content blocking route.
- `apps/mobile/app/journey/preface.tsx`: reject direct access without a saved adult declaration.
- `apps/mobile/app/journey/body-knowledge.tsx`: continue directly to overnight.
- `apps/mobile/src/features/journey/ui/pages/adult-gate-page.tsx`: replace checkbox flow with two explicit choices.
- `apps/mobile/src/features/journey/ui/pages/underage-exit-page.tsx`: render the underage blocking message.
- `apps/mobile/src/features/journey/ui/pages/WelcomePage.tsx`: update help copy for the new order.
- Existing co-located unit and integration tests: lock each route and persistence rule.
- `docs/product/2026-08-28-six-page-local-first-entry.md`: update the effective product order.

### Task 1: Persist the entry declaration and protect restricted routes

**Files:**
- Modify: `apps/mobile/src/features/journey/application/journey-application-service.test.ts`
- Modify: `apps/mobile/src/features/journey/application/journey-application-service.ts`
- Modify: `apps/mobile/src/features/journey/application/journey-navigation.test.ts`
- Modify: `apps/mobile/src/features/journey/application/journey-navigation.ts`

- [ ] **Step 1: Write failing application-state tests**

Add expectations showing that an adult declaration creates/updates a draft at Page 1 rather than Page 2:

```ts
await app.confirmAdult();
expect(app.getSnapshot()).toMatchObject({
  ageConfirmed: true,
  currentPage: "body-knowledge",
  prefaceRead: false,
});
```

Add navigation assertions showing that onboarding and all formal pages remain inaccessible until `ageConfirmed` is true:

```ts
expect(canAccessJourneyPage({ ...welcomed, ageConfirmed: false }, "body-knowledge")).toBe(false);
expect(canAccessJourneyPage({ ...welcomed, ageConfirmed: true }, "body-knowledge")).toBe(true);
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
corepack pnpm --filter @cave/mobile test --runInBand src/features/journey/application/journey-application-service.test.ts src/features/journey/application/journey-navigation.test.ts
```

Expected: FAIL because `confirmAdult()` currently advances to `overnight` and Page 1 currently accepts an unconfirmed onboarding draft.

- [ ] **Step 3: Implement minimal state and guard changes**

Persist the declaration without skipping pages:

```ts
const next = {
  ...current,
  ageConfirmed: true,
  currentPage: "body-knowledge" as const,
  updatedAt: now,
};
```

Make adulthood a prerequisite before the existing sequential checks:

```ts
if (draft === null || !draft.ageConfirmed) return false;
const onboardingCompleted = draft.addressPreference !== null && draft.prefaceRead;
```

- [ ] **Step 4: Run tests and verify GREEN**

Run the command from Step 2. Expected: both suites PASS.

- [ ] **Step 5: Commit the focused state change**

```powershell
git add -- apps/mobile/src/features/journey/application/journey-application-service.test.ts apps/mobile/src/features/journey/application/journey-application-service.ts apps/mobile/src/features/journey/application/journey-navigation.test.ts apps/mobile/src/features/journey/application/journey-navigation.ts
git commit -m "feat: move adult declaration before journey content"
```

### Task 2: Replace the gate UI and restore a no-content underage route

**Files:**
- Modify: `apps/mobile/src/features/journey/ui/pages/AdultGatePage.test.tsx`
- Modify: `apps/mobile/src/features/journey/ui/pages/adult-gate-page.tsx`
- Create: `apps/mobile/src/features/journey/ui/pages/UnderageExitPage.test.tsx`
- Create: `apps/mobile/src/features/journey/ui/pages/underage-exit-page.tsx`
- Modify: `apps/mobile/app/journey/adult-gate.tsx`
- Create: `apps/mobile/app/underage-exit.tsx`

- [ ] **Step 1: Write failing page tests**

The adult gate test must require two direct actions and no checkbox:

```tsx
expect(screen.getByRole("button", { name: "我已年满 18 岁，继续" })).toBeTruthy();
expect(screen.getByRole("button", { name: "我未满 18 岁" })).toBeTruthy();
expect(screen.queryByRole("checkbox")).toBeNull();
```

The underage page test must assert the blocking copy and absence of journey actions:

```tsx
expect(screen.getByRole("header", { name: "这段旅程仅面向成年人" })).toBeTruthy();
expect(screen.getByText(/请关闭 App/u)).toBeTruthy();
expect(screen.queryByText(/开启旅程|继续旅程/u)).toBeNull();
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
corepack pnpm --filter @cave/mobile test --runInBand src/features/journey/ui/pages/AdultGatePage.test.tsx src/features/journey/ui/pages/UnderageExitPage.test.tsx
```

Expected: FAIL because the gate still uses a checkbox and the underage page does not exist.

- [ ] **Step 3: Implement the two-choice UI**

Expose both callbacks:

```tsx
export function AdultGatePage({
  onConfirm,
  onUnderage,
}: {
  onConfirm(): void | Promise<void>;
  onUnderage(): void;
}) {
  return (
    <View testID="adult-gate">
      <Card variant="accent">
        <Text accessibilityRole="header">开启旅程前，需要确认</Text>
        <Text>后续旅程仅面向年满 18 岁的成年人。这里采用你的主动声明，不收集生日，也不把声明当作身份或年龄证明。</Text>
        <Text>旅程回答和私密记录会加密保存在本设备，不会同步到云端。</Text>
      </Card>
      <JourneyAction
        label="我已年满 18 岁，继续"
        loadingLabel="正在保存声明…"
        onAction={onConfirm}
      />
      <TextAction label="我未满 18 岁" onPress={onUnderage} />
    </View>
  );
}
```

Implement `UnderageExitPage` as text-only blocking content outside the journey layout. Route adult confirmation to `/journey/preface` only after persistence; route the underage action to `/underage-exit` without calling the service. If an already-confirmed draft opens the gate, replace it with `/journey/preface` instead of asking again.

- [ ] **Step 4: Run tests and verify GREEN**

Run the command from Step 2. Expected: both suites PASS.

- [ ] **Step 5: Commit the focused UI change**

```powershell
git add -- apps/mobile/src/features/journey/ui/pages/AdultGatePage.test.tsx apps/mobile/src/features/journey/ui/pages/adult-gate-page.tsx apps/mobile/src/features/journey/ui/pages/UnderageExitPage.test.tsx apps/mobile/src/features/journey/ui/pages/underage-exit-page.tsx apps/mobile/app/journey/adult-gate.tsx apps/mobile/app/underage-exit.tsx
git commit -m "feat: add adult and underage entry choices"
```

### Task 3: Rewire home, preface, Page 1 and route guards

**Files:**
- Modify: `apps/mobile/src/features/journey/journey-production-navigation.integration.test.tsx`
- Modify: `apps/mobile/src/features/journey/canonical-routes.integration.test.ts`
- Modify: `apps/mobile/src/features/journey/seven-screen-routes.integration.test.ts`
- Modify: `apps/mobile/src/features/journey/ui/route-boundary.test.ts`
- Modify: `apps/mobile/app/journey/welcome.tsx`
- Modify: `apps/mobile/app/journey/preface.tsx`
- Modify: `apps/mobile/app/journey/body-knowledge.tsx`
- Modify: `apps/mobile/src/features/journey/ui/pages/WelcomePage.test.tsx`
- Modify: `apps/mobile/src/features/journey/ui/pages/WelcomePage.tsx`

- [ ] **Step 1: Write failing production-route tests**

Lock the approved sequence:

```ts
fireEvent.press(screen.getByRole("button", { name: "开启旅程" }));
expect(mockRouter.push).toHaveBeenCalledWith("/journey/adult-gate");

fireEvent.press(screen.getByRole("button", { name: "我已年满 18 岁，继续" }));
await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/journey/preface"));

expect(bodyRouteSource).toContain('onContinue={() => goTo("overnight")}');
```

Add a preface deep-link test with an unconfirmed/null snapshot and expect replacement to `/journey/welcome` without rendering the form.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
corepack pnpm --filter @cave/mobile test --runInBand src/features/journey/journey-production-navigation.integration.test.tsx src/features/journey/canonical-routes.integration.test.ts src/features/journey/seven-screen-routes.integration.test.ts src/features/journey/ui/route-boundary.test.ts src/features/journey/ui/pages/WelcomePage.test.tsx
```

Expected: FAIL because home currently enters preface directly, preface lacks the adult guard, and Page 1 currently opens the old gate.

- [ ] **Step 3: Implement route rewiring and copy**

Change the new-journey action:

```tsx
onStart={() => router.push("/journey/adult-gate")}
```

Guard preface before rendering:

```tsx
useEffect(() => {
  if (runtime.snapshot?.ageConfirmed !== true) router.replace("/journey/welcome");
}, [router, runtime.snapshot?.ageConfirmed]);

if (runtime.snapshot?.ageConfirmed !== true) return null;
```

Change Page 1 continuation to:

```tsx
onContinue={() => goTo("overnight")}
```

Update help copy to say that starting the journey requires an 18+ active declaration before the preface or formal content.

- [ ] **Step 4: Run tests and verify GREEN**

Run the command from Step 2. Expected: all listed suites PASS.

- [ ] **Step 5: Commit the route change**

```powershell
git add -- apps/mobile/src/features/journey/journey-production-navigation.integration.test.tsx apps/mobile/src/features/journey/canonical-routes.integration.test.ts apps/mobile/src/features/journey/seven-screen-routes.integration.test.ts apps/mobile/src/features/journey/ui/route-boundary.test.ts apps/mobile/app/journey/welcome.tsx apps/mobile/app/journey/preface.tsx apps/mobile/app/journey/body-knowledge.tsx apps/mobile/src/features/journey/ui/pages/WelcomePage.test.tsx apps/mobile/src/features/journey/ui/pages/WelcomePage.tsx
git commit -m "feat: gate journey after the public home"
```

### Task 4: Align restart, documentation and full verification

**Files:**
- Modify: `apps/mobile/src/features/journey/ui/JourneyRouteScreen.test.tsx`
- Modify: `apps/mobile/src/features/shell/ui/SettingsScreen.test.tsx`
- Modify: `docs/product/2026-08-28-six-page-local-first-entry.md`
- Modify: `docs/architecture/threat-model.md`

- [ ] **Step 1: Add restart/deletion regression assertions**

Verify restart and deletion return to the public home, not directly to preface or the gate:

```ts
expect(mockReplace).toHaveBeenCalledWith("/journey/welcome");
```

Keep the existing assertion that restart/delete clears the active draft so the next “开启旅程” requires a new declaration.

- [ ] **Step 2: Run focused tests and verify their current result**

Run:

```powershell
corepack pnpm --filter @cave/mobile test --runInBand src/features/journey/ui/JourneyRouteScreen.test.tsx src/features/shell/ui/SettingsScreen.test.tsx
```

Expected: PASS, proving the existing restart and deletion destinations already match the approved design.

- [ ] **Step 3: Update effective product and threat-model documentation**

Replace the old order with:

```text
品牌首页 → 成年主动声明 → 称呼前言 → 1 / 6 身体与安全知识 → 2 / 6 过夜期待 → 后续四页
```

Document direct-route bypass protection and the data-free underage branch.

- [ ] **Step 4: Run the complete verification matrix**

Run:

```powershell
corepack pnpm typecheck
corepack pnpm --filter @cave/mobile lint
corepack pnpm test
corepack pnpm validate:content:draft
corepack pnpm build:gateway
corepack pnpm --filter @cave/mobile exec expo-doctor --verbose
git diff --check
```

Expected: typecheck, lint, all automated tests, draft content validation, Worker dry-run, Expo Doctor and diff check PASS. Production content validation remains a separately reported release blocker until draft/expert-review statuses are resolved.

- [ ] **Step 5: Commit the documentation and final test alignment**

```powershell
git add -- apps/mobile/src/features/journey/ui/JourneyRouteScreen.test.tsx apps/mobile/src/features/shell/ui/SettingsScreen.test.tsx docs/product/2026-08-28-six-page-local-first-entry.md docs/architecture/threat-model.md
git commit -m "docs: align local adult gate entry policy"
```

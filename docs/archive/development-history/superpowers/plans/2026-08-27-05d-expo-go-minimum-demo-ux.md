# 05D Expo Go Minimum Demo UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing eight journey page components usable as a minimum Expo Go demo on small screens, with restored selections, explicit action feedback, keyboard-safe scrolling, and baseline accessibility, while leaving runtime composition to Plan 05C.

**Architecture:** Keep the current `JourneyPages` exports and route-facing props backward compatible. Add journey-local semantic tokens and focused UI primitives under `apps/mobile/src/features/journey/ui/**`; extend pages only with optional controlled/initial values, runtime notices, capability flags, and async action state. Do not modify routes, runtime composition, application/domain/storage code, content review metadata, or shared contracts.

**Tech Stack:** Expo SDK 54, React 19, React Native 0.81, `react-native-safe-area-context`, TypeScript strict, Jest, React Native Testing Library.

---

## Approved design baseline

The source task already approves the design and fixes the scope. This plan therefore records, rather than reopens, the brainstorming decision.

### Selected approach

Use additive UI contracts and journey-local primitives. Existing routes continue compiling because new props are optional; Plan 05C can inject real callbacks, restored values, Expo Go runtime notices, and capability states without 05D importing a repository, controller, gateway, or route API.

Rejected alternatives:

1. Moving the pages into the final Plan 06 global design system would enlarge the conflict surface and prematurely claim final visual/content work.
2. Wiring `apps/mobile/app/**` directly would collide with Plan 05C and take ownership of runtime composition.

### Non-negotiable boundaries

- Owned: `apps/mobile/src/features/journey/ui/**`, journey UI component tests, and this plan.
- Not owned: `apps/mobile/app/**`, runtime composition, domain, application controllers, repositories, storage, gateway, contracts, content catalogs, SQL, and lockfiles.
- Keep `HealthScreen` as the default app entry.
- Keep all 23 journey content records draft; never add or change `reviewedAt`.
- Do not add AI, network calls, accounts, cloud synchronization, marketplace, community, SQL, or secrets.
- Do not compute readiness, reward openness, reward private text, or reward text length.
- Preserve Page 6 “预设对话，不使用 AI”, Page 7 “不是通关表”, and Page 8 edit/copy/fullscreen plus disabled cloud-coming-soon behavior.
- Report production content validation as `content_review_paused`, not as a code failure.

## File map

| File | Responsibility |
|---|---|
| `apps/mobile/src/features/journey/ui/journey-ui-contracts.ts` | Backward-compatible async state, runtime notice, and capability types used only by UI. |
| `apps/mobile/src/features/journey/ui/journey-ui-tokens.ts` | Journey-local semantic colors, spacing, radius, and 44 pt minimum target values. |
| `apps/mobile/src/features/journey/ui/components/JourneyAction.tsx` | Button with selected/loading/disabled accessibility state, duplicate-submit guard, and visible success/error contract. |
| `apps/mobile/src/features/journey/ui/components/JourneyChoice.tsx` | Selected-state wrapper for single- and multi-select controls. |
| `apps/mobile/src/features/journey/ui/components/JourneyStatusBanner.tsx` | Accessible runtime/action notice that never logs private content. |
| `apps/mobile/src/features/journey/ui/JourneyScreenShell.tsx` | Safe-area, keyboard-avoiding, scrollable screen structure with stable page header/back region. |
| `apps/mobile/src/features/journey/ui/JourneyScreenShell.test.tsx` | Long-page, small-screen structure, dynamic text, navigation header, touch target, and runtime notice RED/GREEN coverage. |
| `apps/mobile/src/features/journey/ui/pages/JourneyPages.tsx` | Eight backward-compatible minimum-demo components and optional restored/runtime props. |
| `apps/mobile/src/features/journey/ui/pages/JourneyPages.test.tsx` | Selection, restore, async loading/error, copy failure, keyboard input, explicit navigation, and accessibility coverage. |
| `apps/mobile/src/features/journey/ui/JourneyProvider.tsx` | Existing initialization UI; only journey-local action/status primitives may replace raw controls so initialization failures remain visible and retry/reset cannot double-submit. |
| `apps/mobile/src/features/journey/ui/JourneyProvider.test.tsx` | Initialization loading/error/reset accessibility and duplicate-submit tests. |

## UI contracts to add

```ts
export type JourneyAsyncState = {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
};

export type JourneyRuntimeNotice = {
  message: string;
  accessibilityLabel?: string;
};

export type JourneyCapabilities = {
  canPersistLocally?: boolean;
  canCopy?: boolean;
  canShowFullscreen?: boolean;
  cloudSaveAvailable?: false;
};

export type JourneyAction = () => void | Promise<void>;
```

Every async-capable button must combine its internal in-flight state with an optional externally controlled `JourneyAsyncState`. The first press sets an immediate ref guard before awaiting the callback, subsequent presses do nothing until settlement, loading is visible and announced, rejection becomes a generic visible recoverable error, and an injected safe error message takes precedence. Raw exception text and journey content are never rendered or logged.

## Task 1: Shell structure, tokens, and accessible actions

**Files:**

- Create: `apps/mobile/src/features/journey/ui/journey-ui-contracts.ts`
- Create: `apps/mobile/src/features/journey/ui/journey-ui-tokens.ts`
- Create: `apps/mobile/src/features/journey/ui/components/JourneyAction.tsx`
- Create: `apps/mobile/src/features/journey/ui/components/JourneyChoice.tsx`
- Create: `apps/mobile/src/features/journey/ui/components/JourneyStatusBanner.tsx`
- Modify: `apps/mobile/src/features/journey/ui/JourneyScreenShell.tsx`
- Test: `apps/mobile/src/features/journey/ui/JourneyScreenShell.test.tsx`

- [ ] **Step 1: Write shell and primitive RED tests**

Add tests that require:

```tsx
render(
  <JourneyScreenShell
    pageId="overnight"
    onBack={onBack}
    runtimeNotice={{ message: "Expo Go 演示模式" }}
  >
    {Array.from({ length: 40 }, (_, index) => <Text key={index}>{`long-${index}`}</Text>)}
  </JourneyScreenShell>
);

expect(screen.getByTestId("journey-safe-area")).toBeTruthy();
expect(screen.getByTestId("journey-keyboard-avoiding")).toBeTruthy();
expect(screen.getByTestId("journey-scroll").props.keyboardShouldPersistTaps).toBe("handled");
expect(screen.getByRole("button", { name: "返回上一页" }).props.style).toEqual(
  expect.objectContaining({ minHeight: 44, minWidth: 44 })
);
expect(screen.getByText("Expo Go 演示模式")).toBeTruthy();
```

Also assert that all eight page IDs map to stable Chinese titles, the progress text remains “第 n 页，共 8 页”, the first page reserves the same header geometry without exposing a fake back button, and no title/action text uses `numberOfLines`.

- [ ] **Step 2: Run the shell test and verify RED**

Run:

```powershell
corepack pnpm --filter @cave/mobile test -- --runTestsByPath src/features/journey/ui/JourneyScreenShell.test.tsx
```

Expected: FAIL because safe-area, keyboard-avoiding, scroll, title mapping, runtime notice, and 44 pt action primitives do not exist.

- [ ] **Step 3: Implement the minimum shell and primitives**

Use `SafeAreaView`, `KeyboardAvoidingView`, and `ScrollView`; set `contentContainerStyle` with `flexGrow: 1`, bottom padding, and vertical gap; use `keyboardShouldPersistTaps="handled"` and `keyboardDismissMode="interactive"`. Do not set fixed heights or `numberOfLines` on primary text.

Use semantic tokens with dark text on a warm near-white background, a dark teal interactive surface with white text, a pale selected surface with dark text, and a dark red error foreground on a pale error surface. All pressables use at least `minHeight: 44` and `minWidth: 44`.

- [ ] **Step 4: Run the shell test and verify GREEN**

Run the command from Step 2. Expected: PASS with no warnings.

## Task 2: Restorable and testable selection state on Pages 2, 4, 5, and 7

**Files:**

- Modify: `apps/mobile/src/features/journey/ui/pages/JourneyPages.tsx`
- Test: `apps/mobile/src/features/journey/ui/pages/JourneyPages.test.tsx`

- [ ] **Step 1: Write selection and restoration RED tests**

Required cases:

```tsx
render(<OvernightPage
  expectationOptions={[{ id: "rest", label: "好好休息" }]}
  concernOptions={[{ id: "pressure", label: "担心被催促" }]}
  initialExpectationIds={["rest"]}
  initialConcernIds={["pressure"]}
  initialCustomNote="需要安静空间"
  onContinue={onContinue}
/>);
expect(screen.getByRole("checkbox", { name: "好好休息" }).props.accessibilityState.selected).toBe(true);
```

Add equivalent tests for:

- Page 4 `initialAttitudes` and radio `checked/selected` state for each behavior.
- Page 5 initial motivation IDs, comfort IDs, tri-state expression support, and journal save choice.
- Page 7 restored item status and note, with one selected radio state per item.
- State is conveyed by label/text plus accessibility state, never color alone.
- Submitting Page 2 or Page 5 returns the restored values unchanged when the user makes no edits.
- No readiness/score/percentage field or point mutation derives from selected values or text length.

- [ ] **Step 2: Run the page test and verify RED**

Run:

```powershell
corepack pnpm --filter @cave/mobile test -- --runTestsByPath src/features/journey/ui/pages/JourneyPages.test.tsx
```

Expected: FAIL on missing initial props, roles, selected states, Page 5 choices, and Page 7 restored notes.

- [ ] **Step 3: Implement additive initial/controlled props**

Keep existing required props valid. Add optional props only:

```ts
type OvernightPageProps = {
  initialExpectationIds?: string[];
  initialConcernIds?: string[];
  initialCustomNote?: string;
  actionState?: JourneyAsyncState;
  runtimeNotice?: JourneyRuntimeNotice;
};

type BehaviorAttitudesPageProps = {
  initialAttitudes?: Partial<Record<string, BehaviorAttitude>>;
  onContinue?: JourneyAction;
  actionState?: JourneyAsyncState;
};
```

Page 5 receives optional draft option arrays and initial values, defaulting to current empty selections, `null`, and `device`. Page 7 continues to treat `items[].status` and `items[].userNote` as the restored source of truth; local note edits are keyed by stable item ID.

- [ ] **Step 4: Run the page test and verify GREEN**

Run the command from Step 2. Expected: PASS with explicit selected-state assertions.

## Task 3: Explicit navigation and Page 6–8 disclosure/actions

**Files:**

- Modify: `apps/mobile/src/features/journey/ui/pages/JourneyPages.tsx`
- Test: `apps/mobile/src/features/journey/ui/pages/JourneyPages.test.tsx`

- [ ] **Step 1: Write disclosure and navigation RED tests**

Require:

- Every page component exposes a primary continue/finish action; Pages 3, 4, and 8 gain optional callbacks so current routes keep compiling.
- Page 6 visibly renders the exact disclosure “预设对话，不使用 AI”.
- Page 7 visibly renders “这不是需要全部勾选的通关表”.
- Page 8 keeps editable fields, copy, fullscreen display, local save, a finish action, and a disabled cloud-coming-soon button.
- Page 8 capability props can independently disable local save, copy, and fullscreen without hiding the action or enabling cloud.
- Fullscreen mode keeps pause/confirmation content visible and offers an explicit exit.

- [ ] **Step 2: Run the page test and verify RED**

Run the Task 2 page-test command. Expected: FAIL on missing Page 3/4/8 callbacks, exact Page 6 disclosure, finish action, and capability behavior.

- [ ] **Step 3: Implement the minimum explicit actions**

Add optional `onContinue` to Pages 3 and 4 and optional `onFinish` to Page 8. When a callback is absent, render the action disabled so integration gaps remain visible. Keep cloud always disabled regardless of capability input. Do not add navigation or storage imports.

- [ ] **Step 4: Run the page test and verify GREEN**

Run the Task 2 page-test command. Expected: PASS.

## Task 4: Async loading, duplicate-submit guard, and visible failures

**Files:**

- Modify: `apps/mobile/src/features/journey/ui/components/JourneyAction.tsx`
- Modify: `apps/mobile/src/features/journey/ui/pages/JourneyPages.tsx`
- Modify: `apps/mobile/src/features/journey/ui/JourneyProvider.tsx`
- Test: `apps/mobile/src/features/journey/ui/pages/JourneyPages.test.tsx`
- Test: `apps/mobile/src/features/journey/ui/JourneyProvider.test.tsx`

- [ ] **Step 1: Write async RED tests**

Use a deferred promise and assert:

```tsx
fireEvent.press(screen.getByRole("button", { name: "复制当前卡片" }));
fireEvent.press(screen.getByRole("button", { name: "复制当前卡片" }));
expect(onCopy).toHaveBeenCalledTimes(1);
expect(screen.getByRole("button", { name: /正在复制/u }).props.accessibilityState.disabled).toBe(true);
deferred.reject(new Error("private raw failure"));
expect(await screen.findByText("复制失败，请重试。 ")).toBeTruthy();
expect(screen.queryByText("private raw failure")).toBeNull();
```

Normalize the expected string without the illustrative trailing space when implementing. Add equivalent save/continue/finish coverage and initialization retry/reset coverage. Test externally injected loading/error state as well as internally caught promise rejection. Verify `accessibilityState.busy`, `disabled`, and `accessibilityLiveRegion="polite"`.

- [ ] **Step 2: Run focused page/provider tests and verify RED**

Run:

```powershell
corepack pnpm --filter @cave/mobile test -- --runTestsByPath src/features/journey/ui/pages/JourneyPages.test.tsx src/features/journey/ui/JourneyProvider.test.tsx
```

Expected: FAIL because current actions permit duplicate presses and discard async failures.

- [ ] **Step 3: Implement guarded async action behavior**

The primitive must set a ref guard synchronously before invoking the callback, expose a loading label/state, clear the guard in `finally`, and render a generic action-specific error if the promise rejects. Provider initialization continues to show a safe generic storage message; retry/reset use the same guarded primitive. Never render `error.message`, stringify input, or log action payloads.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: PASS with no unhandled-promise warnings.

## Task 5: Keyboard, input, touch, and baseline contrast coverage

**Files:**

- Modify: `apps/mobile/src/features/journey/ui/pages/JourneyPages.tsx`
- Test: `apps/mobile/src/features/journey/ui/JourneyScreenShell.test.tsx`
- Test: `apps/mobile/src/features/journey/ui/pages/JourneyPages.test.tsx`

- [ ] **Step 1: Write RED tests for input and accessibility structure**

Require labels for every `TextInput`, multiline notes where appropriate, visible focusable inputs inside the shell scroll view, 44 pt minimum styles on all actions/choices, and semantic roles/states for buttons, checkboxes, and radios. Add a pure test helper that calculates WCAG contrast from exported tokens and requires at least 4.5:1 for body text/background, action text/action background, selected text/selected background, and error text/error background.

- [ ] **Step 2: Run shell/page tests and verify RED**

Run both focused test files. Expected: FAIL on unlabeled inputs, target size, roles/states, and missing tokens.

- [ ] **Step 3: Implement the minimum accessibility pass**

Add `accessibilityLabel`, role, hint only where it adds information, and state to all interactive elements. Keep inputs and actions vertically growable. Do not use fixed line counts, fixed control heights below 44, or color-only selected/error signals.

- [ ] **Step 4: Run shell/page tests and verify GREEN**

Run both focused test files. Expected: PASS.

## Task 6: Scope and regression verification

**Files:**

- Test only; do not change non-owned files to make checks pass.

- [ ] **Step 1: Run focused UI tests**

```powershell
corepack pnpm --filter @cave/mobile test -- --runTestsByPath src/features/journey/ui/JourneyScreenShell.test.tsx src/features/journey/ui/pages/JourneyPages.test.tsx src/features/journey/ui/JourneyProvider.test.tsx
```

Expected: all focused suites pass.

- [ ] **Step 2: Run required mobile gates**

```powershell
corepack pnpm --filter @cave/mobile typecheck
corepack pnpm --filter @cave/mobile lint
corepack pnpm --filter @cave/mobile test
corepack pnpm --filter @cave/mobile expo:doctor
```

Expected: exit code 0 for each; Expo Doctor reports 18/18 checks.

- [ ] **Step 3: Reuse upstream offline/content evidence without altering dependencies**

```powershell
# Do not rerun dependency installation in 05D. Reuse the frozen offline install
# and workspace validation evidence from merged PR #6 / main CI run 33069700001.
```

Expected: no lockfile or dependency changes. Treat the 23 unchanged `DRAFT_CONTENT` journey records as `content_review_paused`, not a 05D code failure; do not rerun production validation or approve content while review is paused.

- [ ] **Step 4: Run boundary and forbidden-feature scans**

```powershell
rg -n "GatewayClient|ModelProvider|/v1/practice|fetch\(|SELECT\s|INSERT\s|OPENAI|API_KEY" apps/mobile/src/features/journey/ui
rg -n "readiness|percentage|cloudEnabled|AI generated" apps/mobile/src/features/journey/ui
git diff --name-only origin/main...HEAD
git diff --check
```

Expected: both forbidden scans have no matches (exit 1); changed paths are only this plan and `apps/mobile/src/features/journey/ui/**`; diff check exits 0.

- [ ] **Step 5: Review the requirement matrix**

Confirm each source requirement has direct evidence:

1. Safe area, scroll, keyboard avoidance, stable header, long content.
2. Visible selected/restored state for Pages 2/4/5/7.
3. Async loading/disable/error, including copy/save/init failure.
4. Explicit eight-page actions and required Page 6/7/8 disclosures.
5. Optional runtime notice/capability props ready for Plan 05C.
6. No `reviewedAt`, route, runtime, domain, repository, controller, SQL, network, AI, secret, or lockfile change.

## Task 7: Independent commit, push, and pull request

- [ ] **Step 1: Inspect the final diff before staging**

```powershell
git status --short
git diff --stat
git diff -- apps/mobile/app apps/mobile/src/features/journey/domain apps/mobile/src/features/journey/application apps/mobile/src/features/journey/infrastructure pnpm-lock.yaml
```

Expected: the last command has no output.

- [ ] **Step 2: Create one English implementation commit**

```powershell
git add docs/superpowers/plans/2026-08-27-05d-expo-go-minimum-demo-ux.md apps/mobile/src/features/journey/ui
git commit -m "feat(mobile): add minimum journey demo interactions"
```

- [ ] **Step 3: Push the dedicated branch**

```powershell
git push -u origin codex/plan-05d-expo-go-minimum-demo-ux
```

- [ ] **Step 4: Open a standalone PR without merging**

Use base `main`, head `codex/plan-05d-expo-go-minimum-demo-ux`, and include:

- the RED/GREEN and final gate evidence;
- `content_review_paused` for the 23 draft fixtures;
- no Apple membership or real-device claim;
- the Plan 05C integration points below;
- likely conflict files: `JourneyScreenShell.tsx`, `JourneyPages.tsx`, and their tests only if 05C also edits UI props.

## Plan 05C minimum integration points

Plan 05C must:

1. Pass safe Expo Go mode copy through `JourneyScreenShell.runtimeNotice`; 05D does not determine runtime mode.
2. Pass restored draft values into Page 2 `initialExpectationIds`/`initialConcernIds`/`initialCustomNote`, Page 4 `initialAttitudes`, Page 5 reflection initial props, and Page 7 `items`.
3. Provide real async callbacks for continue/back/finish, selection persistence, Page 8 save/copy, and provider initialization. Returning promises enables 05D loading and failure UI.
4. Map runtime capabilities to Page 8 `capabilities`; cloud remains disabled even if an incorrect true-like value is attempted.
5. Keep route navigation, controller dispatch, repositories, clipboard adapter, and storage-runtime selection in Plan 05C-owned files.

No callback requires a domain/shared-contract change. If 05C needs richer application data, it should adapt that data before passing these UI props rather than moving runtime imports into `ui/**`.

## Post-05C rebase integration note

On 2026-08-27, the 05D commit was rebased locally onto `origin/main` at `ca87509`, which contains merged Plan 05C. The conflict resolution preserves both layers:

- `JourneyProvider` keeps 05C `runAndRefresh` and structured runtime error codes while adding 05D stale-service, unmount, duplicate-action, and safe-feedback guards.
- Page 4 accepts the 05C canonical `currentAttitudes` prop alongside the additive 05D initial-state contract.
- Page 6 keeps the complete 05C behavior/intent/phrase/partner-response payload and adds the required non-AI disclosure and accessible controls.
- Page 7 serializes per-item writes and queues completion until current and dirty item values are persisted.
- Page 8 restores 05C auto-persistence and `ClipboardActionState`; save, copy, and finish are serialized after pending field edits, while fullscreen stays unavailable during the queue.
- Existing app routes, runtime selection, controllers, repositories, domain code, and the lockfile remain unchanged by 05D. Route callbacks that discard returned promises remain a Plan 05C-owned follow-up for route-level loading feedback; the UI contracts continue to accept Promise-returning callbacks.

The withdrawn PR #8 and its remote branch retain the pre-rebase commit as a recovery point. The rebased local branch is intentionally not force-pushed so it can be inspected before any new PR is opened.

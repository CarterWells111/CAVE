# Restore Preface Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the persisted “欢迎来到内界 CAVE” reading popup between address selection and the first formal journey page.

**Architecture:** Keep `/journey/preface` as the only onboarding route and let its persisted snapshot select one of three states: address choice, unread popup, or completed redirect. Add a focused popup component that owns only content and async confirmation UI, and extend the shared `BottomSheet` with a backwards-compatible non-dismissible mode so acknowledgment is the only way into formal content.

**Tech Stack:** Expo Router, React Native, TypeScript, Jest, Testing Library React Native, existing `BottomSheet`, `JourneyAction`, and journey runtime/reducer commands.

---

## File map

- Modify `apps/mobile/src/core/ui/bottom-sheet.tsx`: add optional non-dismissible modal behavior while preserving the default close behavior.
- Modify `apps/mobile/src/core/ui/overlays.test.tsx`: lock the non-dismissible accessibility and hardware-back contract.
- Create `apps/mobile/src/features/journey/ui/pages/preface-welcome-sheet.tsx`: render the restored four-paragraph note and confirmation action.
- Create `apps/mobile/src/features/journey/ui/pages/PrefaceWelcomeSheet.test.tsx`: verify content, pronoun substitution, single journey action, and retry UI.
- Modify `apps/mobile/src/features/journey/ui/pages/preface-page.tsx`: use the domain address type; remain responsible only for selecting and saving an address.
- Modify `apps/mobile/src/features/journey/ui/pages/PrefacePage.test.tsx`: rename the test intent so it no longer claims the note and address are one step.
- Modify `apps/mobile/app/journey/preface.tsx`: orchestrate persisted address, unread-popup, and completed states.
- Modify `apps/mobile/src/features/journey/journey-production-navigation.integration.test.tsx`: prove persistence and navigation ordering with the real in-memory runtime.

### Task 1: Make BottomSheet optionally non-dismissible

**Files:**
- Modify: `apps/mobile/src/core/ui/bottom-sheet.tsx:16-103`
- Test: `apps/mobile/src/core/ui/overlays.test.tsx`

- [ ] **Step 1: Write the failing non-dismissible sheet test**

Append a test that renders the real primitive, verifies there is no close action, and proves the Android/back callback cannot dismiss it:

```tsx
test("supports a non-dismissible reading sheet without exposing a skip action", () => {
  const onClose = jest.fn();
  const focus = jest.spyOn(AccessibilityInfo, "setAccessibilityFocus").mockImplementation(jest.fn());
  const resolveFocusHandle = jest.fn((node) => node === null ? null : 42);
  render(
    <BottomSheet
      dismissible={false}
      onClose={onClose}
      resolveFocusHandle={resolveFocusHandle}
      title="欢迎来到内界 CAVE"
      visible
    >
      <Text>阅读内容</Text>
    </BottomSheet>,
  );

  expect(screen.queryByRole("button", { name: "关闭欢迎来到内界 CAVE" })).toBeNull();
  fireEvent(screen.getByTestId("bottom-sheet-modal"), "show");
  expect(focus).toHaveBeenCalledWith(42);
  fireEvent(screen.getByTestId("bottom-sheet-modal"), "requestClose");
  fireEvent(screen.getByTestId("bottom-sheet-panel"), "accessibilityEscape");
  expect(onClose).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
corepack pnpm --filter @cave/mobile test -- src/core/ui/overlays.test.tsx
```

Expected: FAIL because `BottomSheetProps` does not accept `dismissible` and the close action is still rendered.

- [ ] **Step 3: Implement the minimal backwards-compatible prop**

Add the optional prop beside `onClose`:

```tsx
onClose: () => void;
dismissible?: boolean;
```

Default it in the component arguments:

```tsx
onClose,
dismissible = true,
onInitialFocus,
```

Add a title ref beside `closeRef`:

```tsx
const titleRef = useRef<Text>(null);
```

Make `handleShow` focus the close action in the default mode and the heading in required-reading mode:

```tsx
const handleShow = () => {
  const initialFocusTarget = dismissible ? closeRef.current : titleRef.current;
  const focusNode = resolveFocusHandle(initialFocusTarget);
  if (focusNode !== null) AccessibilityInfo.setAccessibilityFocus(focusNode);
  onInitialFocus?.();
};
```

Add one guarded request handler after `handleShow`:

```tsx
const handleDismissRequest = () => {
  if (dismissible) onClose();
};
```

Use that handler for both platform dismissal paths:

```tsx
onRequestClose={handleDismissRequest}
```

```tsx
onAccessibilityEscape={handleDismissRequest}
```

Replace the unconditional header action with:

```tsx
{dismissible ? <TextAction ref={closeRef} label={closeLabel} onPress={onClose} /> : null}
```

Attach the new ref to the existing heading without changing its styles or content:

```tsx
<Text
  accessibilityRole="header"
  ref={titleRef}
  style={{ ...theme.typography.heading, color: theme.color.text, flex: 1, flexShrink: 1 }}
>
  {title}
</Text>
```

Retain all current inline styles, safe-area handling, keyboard handling, test IDs, and scroll behavior around the shown conditional changes.

- [ ] **Step 4: Run primitive tests and verify GREEN**

Run:

```powershell
corepack pnpm --filter @cave/mobile test -- src/core/ui/overlays.test.tsx
```

Expected: PASS, including all existing dismissible-sheet tests.

- [ ] **Step 5: Commit the primitive change**

```powershell
git add -- apps/mobile/src/core/ui/bottom-sheet.tsx apps/mobile/src/core/ui/overlays.test.tsx
git commit -m "feat(mobile): support required reading sheets"
```

### Task 2: Add the restored welcome reading sheet

**Files:**
- Create: `apps/mobile/src/features/journey/ui/pages/preface-welcome-sheet.tsx`
- Create: `apps/mobile/src/features/journey/ui/pages/PrefaceWelcomeSheet.test.tsx`

- [ ] **Step 1: Write failing component tests for content and async retry**

Create the test file with two focused tests:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { PrefaceWelcomeSheet } from "./preface-welcome-sheet";

test("shows the restored welcome note for the persisted form of address", () => {
  render(<PrefaceWelcomeSheet onConfirm={jest.fn()} preference="妳" visible />);

  expect(screen.getByRole("header", { name: "欢迎来到内界 CAVE" })).toBeTruthy();
  expect(screen.getByText(/身体可能会自然作出反应.*让妳好奇.*让妳不适/u)).toBeTruthy();
  expect(screen.getByText(/从认识身体与同意开始.*形成自己对性与亲密的理解/u)).toBeTruthy();
  expect(screen.getByText(/不会替妳下结论.*成为一个起点/u)).toBeTruthy();
  expect(screen.getByText(/不是为了让妳表现得更大胆.*由妳决定是否告诉别人/u)).toBeTruthy();
  expect(screen.getByRole("button", { name: "我已了解，开始旅程" })).toBeTruthy();
  expect(screen.queryByText(/先跳过/u)).toBeNull();
  expect(screen.queryByRole("button", { name: /关闭/u })).toBeNull();
});

test("keeps the sheet open and allows retry when the read marker fails", async () => {
  const onConfirm = jest.fn()
    .mockRejectedValueOnce(new Error("private persistence detail"))
    .mockResolvedValue(undefined);
  render(<PrefaceWelcomeSheet onConfirm={onConfirm} preference="你" visible />);

  fireEvent.press(screen.getByRole("button", { name: "我已了解，开始旅程" }));
  expect(await screen.findByText("阅读状态暂时无法保存，请重试。")).toBeTruthy();
  expect(screen.queryByText("private persistence detail")).toBeNull();

  fireEvent.press(screen.getByRole("button", { name: "我已了解，开始旅程" }));
  await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2));
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
corepack pnpm --filter @cave/mobile test -- src/features/journey/ui/pages/PrefaceWelcomeSheet.test.tsx
```

Expected: FAIL because `preface-welcome-sheet.tsx` does not exist.

- [ ] **Step 3: Implement the focused reading-sheet component**

Create the component using the domain type, themed body text, the non-dismissible primitive, and the existing async action:

```tsx
import { Text } from "react-native";

import { useTheme } from "../../../../core/design/theme-provider";
import { BottomSheet } from "../../../../core/ui/bottom-sheet";
import type { AddressPreference } from "../../domain/types";
import { JourneyAction } from "../components/JourneyAction";

type Props = {
  onConfirm(): void | Promise<void>;
  preference: Exclude<AddressPreference, null>;
  visible: boolean;
};

export function PrefaceWelcomeSheet({ onConfirm, preference, visible }: Props) {
  const theme = useTheme();
  const bodyStyle = { ...theme.typography.body, color: theme.color.text };

  return (
    <BottomSheet
      dismissible={false}
      onClose={() => undefined}
      title="欢迎来到内界 CAVE"
      visible={visible}
    >
      <Text selectable style={bodyStyle}>
        遇见喜欢的人，听到某句情话，或面对某种爱抚与刺激时，身体可能会自然作出反应。这些反应可能让{preference}好奇，也可能让{preference}不适，甚至觉得不可接受。
      </Text>
      <Text selectable style={bodyStyle}>
        无论是哪一种，{preference}都可以从认识身体与同意开始，慢慢形成自己对性与亲密的理解。
      </Text>
      <Text selectable style={bodyStyle}>
        我们知道，界面里的文字不一定能完整托住{preference}的经历，也不会替{preference}下结论。希望它们可以成为一个起点：{preference}可以记下此刻的感受，在情境练习里试着说出一句话，也可以在安全、独处时对着镜子练习。
      </Text>
      <Text selectable style={bodyStyle}>
        这不是为了让{preference}表现得更大胆，而是让那些过去没有被看见的需要与声音，更容易先被{preference}自己听见，再由{preference}决定是否告诉别人。
      </Text>
      <JourneyAction
        errorMessage="阅读状态暂时无法保存，请重试。"
        label="我已了解，开始旅程"
        loadingLabel="正在进入旅程…"
        onAction={onConfirm}
      />
    </BottomSheet>
  );
}
```

- [ ] **Step 4: Run component and overlay tests and verify GREEN**

Run:

```powershell
corepack pnpm --filter @cave/mobile test -- src/features/journey/ui/pages/PrefaceWelcomeSheet.test.tsx src/core/ui/overlays.test.tsx
```

Expected: PASS with no console errors or warnings.

- [ ] **Step 5: Commit the reading component**

```powershell
git add -- apps/mobile/src/features/journey/ui/pages/preface-welcome-sheet.tsx apps/mobile/src/features/journey/ui/pages/PrefaceWelcomeSheet.test.tsx
git commit -m "feat(mobile): restore preface welcome sheet"
```

### Task 3: Restore persisted two-stage preface routing

**Files:**
- Modify: `apps/mobile/app/journey/preface.tsx:1-28`
- Modify: `apps/mobile/src/features/journey/ui/pages/preface-page.tsx:1-45`
- Modify: `apps/mobile/src/features/journey/ui/pages/PrefacePage.test.tsx:1-22`
- Test: `apps/mobile/src/features/journey/journey-production-navigation.integration.test.tsx:111-285`

- [ ] **Step 1: Rewrite the integration expectation as a failing ordering test**

Replace the existing “preface persists the chosen address” test with a test that proves the two writes and navigation occur in separate user actions:

```tsx
test("preface saves the address before showing the required welcome note", async () => {
  const journeyRuntime = runtime();
  await journeyRuntime.service.confirmAdult();
  const originalId = journeyRuntime.service.getSnapshot()?.id;
  const view = await openRoute(<PrefaceRoute />, journeyRuntime);

  fireEvent.press(screen.getByRole("radio", { name: "妳｜明确称呼女性，更有书信感。" }));
  fireEvent.press(screen.getByRole("button", { name: "这样称呼我" }));

  await waitFor(() => expect(journeyRuntime.service.getSnapshot()).toMatchObject({
    id: originalId,
    addressPreference: "妳",
    ageConfirmed: true,
    prefaceRead: false,
    currentPage: "body-knowledge",
  }));
  expect(await screen.findByRole("header", { name: "欢迎来到内界 CAVE" })).toBeTruthy();
  expect(mockRouter.replace).not.toHaveBeenCalledWith("/journey/body-knowledge");

  fireEvent.press(screen.getByRole("button", { name: "我已了解，开始旅程" }));

  await waitFor(() => expect(journeyRuntime.service.getSnapshot()?.prefaceRead).toBe(true));
  expect(mockRouter.replace).toHaveBeenCalledWith("/journey/body-knowledge");
  view.unmount();
});
```

Add two restoration-state tests:

```tsx
test("an address saved before interruption resumes directly at the welcome note", async () => {
  const journeyRuntime = runtime();
  await journeyRuntime.service.confirmAdult();
  await journeyRuntime.service.dispatch({ type: "set-address-preference", preference: "你" });

  const view = await openRoute(<PrefaceRoute />, journeyRuntime);

  expect(await screen.findByRole("header", { name: "欢迎来到内界 CAVE" })).toBeTruthy();
  expect(screen.queryByRole("radio")).toBeNull();
  expect(mockRouter.replace).not.toHaveBeenCalledWith("/journey/body-knowledge");
  view.unmount();
});

test("a completed preface deep link continues to the first formal page", async () => {
  const journeyRuntime = runtime();
  await journeyRuntime.service.confirmAdult();
  await journeyRuntime.service.dispatch({ type: "set-address-preference", preference: "你" });
  await journeyRuntime.service.dispatch({ type: "set-preface-read", read: true });

  const view = await openRoute(<PrefaceRoute />, journeyRuntime);

  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/journey/body-knowledge"));
  expect(screen.queryByRole("header", { name: "欢迎来到内界 CAVE" })).toBeNull();
  view.unmount();
});
```

- [ ] **Step 2: Run the route tests and verify RED**

Run:

```powershell
corepack pnpm --filter @cave/mobile test -- src/features/journey/journey-production-navigation.integration.test.tsx
```

Expected: FAIL because the address action still writes `prefaceRead=true` and immediately navigates.

- [ ] **Step 3: Keep PrefacePage address-only and use the domain type**

Replace its local duplicate type with the canonical non-null domain type:

```tsx
import type { AddressPreference } from "../../domain/types";

type SelectedAddressPreference = Exclude<AddressPreference, null>;

export function PrefacePage({
  onContinue,
}: {
  onContinue(preference: SelectedAddressPreference): void | Promise<void>;
}) {
  const theme = useTheme();
  const [preference, setPreference] = useState<SelectedAddressPreference | null>(null);
}
```

Do not change the rendered title, explanatory copy, two address choices, or the `JourneyAction` label and error handling in this task.

Rename the first component test to `"requires a chosen form of address before saving it"`; retain its assertions so the address step cannot regress.

- [ ] **Step 4: Implement snapshot-driven route orchestration**

Replace the route body with explicit persisted-state branches:

```tsx
import { useRouter } from "expo-router";
import { useEffect } from "react";

import { Screen } from "../../src/core/ui/Screen";
import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { PrefacePage } from "../../src/features/journey/ui/pages/preface-page";
import { PrefaceWelcomeSheet } from "../../src/features/journey/ui/pages/preface-welcome-sheet";

export default function PrefaceRoute() {
  const router = useRouter();
  const runtime = useJourneyRuntime();
  const snapshot = runtime.snapshot;
  const eligible = snapshot?.ageConfirmed === true;
  const preference = snapshot?.addressPreference ?? null;
  const prefaceRead = snapshot?.prefaceRead === true;
  const completed = eligible && preference !== null && prefaceRead;

  useEffect(() => {
    if (!eligible) {
      router.replace("/journey/welcome");
      return;
    }
    if (completed) router.replace("/journey/body-knowledge");
  }, [completed, eligible, router]);

  if (!eligible || completed) return null;

  return (
    <Screen>
      {preference === null ? (
        <PrefacePage
          onContinue={(nextPreference) => runtime.runAndRefresh(() => (
            runtime.service.dispatch({ type: "set-address-preference", preference: nextPreference })
          ))}
        />
      ) : (
        <PrefaceWelcomeSheet
          onConfirm={() => runtime.runAndRefresh(() => (
            runtime.service.dispatch({ type: "set-preface-read", read: true })
          ))}
          preference={preference}
          visible
        />
      )}
    </Screen>
  );
}
```

- [ ] **Step 5: Run all preface and navigation tests and verify GREEN**

Run:

```powershell
corepack pnpm --filter @cave/mobile test -- src/features/journey/ui/pages/PrefacePage.test.tsx src/features/journey/ui/pages/PrefaceWelcomeSheet.test.tsx src/features/journey/journey-production-navigation.integration.test.tsx src/features/journey/application/journey-navigation.test.ts
```

Expected: PASS; the persisted snapshot is `prefaceRead=false` until the popup confirmation action.

- [ ] **Step 6: Commit the route restoration**

```powershell
git add -- apps/mobile/app/journey/preface.tsx apps/mobile/src/features/journey/ui/pages/preface-page.tsx apps/mobile/src/features/journey/ui/pages/PrefacePage.test.tsx apps/mobile/src/features/journey/journey-production-navigation.integration.test.tsx
git commit -m "fix(mobile): restore two-stage journey preface"
```

### Task 4: Full verification and handoff

**Files:**
- Verify only; no production changes expected.

- [ ] **Step 1: Run the full mobile suite**

```powershell
corepack pnpm --filter @cave/mobile test
```

Expected: all mobile test suites pass with zero failures.

- [ ] **Step 2: Run TypeScript and ESLint**

```powershell
corepack pnpm --filter @cave/mobile typecheck
corepack pnpm --filter @cave/mobile lint
```

Expected: both commands exit 0 without errors.

- [ ] **Step 3: Verify repository hygiene and scope**

```powershell
git diff --check
git status --short
git log --oneline origin/main..HEAD
```

Expected: no whitespace errors; only the design and implementation commits appear; no auth/journal files are changed in this worktree.

- [ ] **Step 4: Request final code review**

Ask the reviewer to verify:

- address persistence and `prefaceRead` ordering;
- no route into formal content before acknowledgment succeeds;
- unread-popup restoration after remount;
- no changes to adult declaration or private-data gates;
- non-dismissible sheet accessibility and small-screen scrolling.

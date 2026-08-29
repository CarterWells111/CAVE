import { fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Text, type View } from "react-native";

import { BottomSheet } from "./bottom-sheet";

afterEach(() => {
  jest.restoreAllMocks();
});

test("BottomSheet exposes modal semantics, explicit close, back close, and scroll-safe content", () => {
  const onClose = jest.fn();
  render(<BottomSheet onClose={onClose} title="选择称呼" visible><Text>内容</Text></BottomSheet>);
  const sheet = screen.getByTestId("bottom-sheet-panel");
  expect(sheet).toHaveProp("accessibilityLabel", "选择称呼");
  expect(sheet).toHaveProp("accessibilityViewIsModal", true);
  expect(screen.getByTestId("bottom-sheet-scroll")).toHaveProp("keyboardShouldPersistTaps", "handled");
  fireEvent.press(screen.getByRole("button", { name: "关闭选择称呼" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  fireEvent(screen.getByTestId("bottom-sheet-modal"), "requestClose");
  expect(onClose).toHaveBeenCalledTimes(2);
});

test("BottomSheet exposes verifiable initial-focus and focus-restore callbacks", () => {
  const onInitialFocus = jest.fn();
  const onRestoreFocus = jest.fn();
  const { rerender } = render(
    <BottomSheet onClose={jest.fn()} onInitialFocus={onInitialFocus} onRestoreFocus={onRestoreFocus} title="来源" visible />,
  );
  fireEvent(screen.getByTestId("bottom-sheet-modal"), "show");
  expect(onInitialFocus).toHaveBeenCalledTimes(1);
  const modal = screen.getByTestId("bottom-sheet-modal");
  fireEvent(modal, "dismiss");
  rerender(<BottomSheet onClose={jest.fn()} onInitialFocus={onInitialFocus} onRestoreFocus={onRestoreFocus} title="来源" visible={false} />);
  expect(onRestoreFocus).toHaveBeenCalledTimes(1);
});

test("BottomSheet moves initial accessibility focus to close and supports accessibility escape", () => {
  const onClose = jest.fn();
  const focus = jest.spyOn(AccessibilityInfo, "setAccessibilityFocus").mockImplementation(jest.fn());
  let resolvedFocusTarget: { label?: unknown; role?: unknown } = {};
  const resolveFocusHandle = jest.fn((target) => {
    const closeTarget = target as Text | null;
    resolvedFocusTarget = {
      label: closeTarget?.props.accessibilityLabel,
      role: closeTarget?.props.accessibilityRole,
    };
    return 42;
  });
  render(<BottomSheet onClose={onClose} resolveFocusHandle={resolveFocusHandle} title="来源" visible />);
  fireEvent(screen.getByTestId("bottom-sheet-modal"), "show");
  expect(resolveFocusHandle).toHaveBeenCalledTimes(1);
  expect(resolvedFocusTarget).toEqual({ label: "关闭来源", role: "button" });
  expect(focus).toHaveBeenCalledWith(42);
  fireEvent(screen.getByTestId("bottom-sheet-panel"), "accessibilityEscape");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("BottomSheet restores focus through the returnFocusRef contract while retaining callbacks", () => {
  const focus = jest.spyOn(AccessibilityInfo, "setAccessibilityFocus").mockImplementation(jest.fn());
  const onRestoreFocus = jest.fn();
  const returnFocusRef = { current: {} } as React.RefObject<View | null>;
  const { rerender } = render(
    <BottomSheet
      onClose={jest.fn()}
      onRestoreFocus={onRestoreFocus}
      resolveFocusHandle={(() => 77) as never}
      returnFocusRef={returnFocusRef}
      title="来源"
      visible
    />,
  );

  const modal = screen.getByTestId("bottom-sheet-modal");
  fireEvent(modal, "dismiss");
  rerender(
    <BottomSheet
      onClose={jest.fn()}
      onRestoreFocus={onRestoreFocus}
      resolveFocusHandle={(() => 77) as never}
      returnFocusRef={returnFocusRef}
      title="来源"
      visible={false}
    />,
  );
  expect(focus).toHaveBeenCalledWith(77);
  expect(onRestoreFocus).toHaveBeenCalledTimes(1);
});

test("BottomSheet uses bottom safe-area insets and disables motion when requested", () => {
  render(<BottomSheet onClose={jest.fn()} reducedMotion title="来源" visible />);
  expect(screen.getByTestId("bottom-sheet-modal")).toHaveProp("animationType", "none");
  expect(screen.getByTestId("bottom-sheet-safe-area")).toHaveProp("edges", {
    bottom: "additive", left: "off", right: "off", top: "off",
  });
});

test("BottomSheet can remove its fixed visual header without losing modal dismissal", () => {
  const onClose = jest.fn();
  const onInitialFocus = jest.fn();
  render(
    <BottomSheet hideHeader onClose={onClose} onInitialFocus={onInitialFocus} title="编辑沟通草稿" visible>
      <Text>编辑内容</Text>
    </BottomSheet>,
  );

  expect(screen.queryByRole("header", { name: "编辑沟通草稿" })).toBeNull();
  expect(screen.queryByRole("button", { name: "关闭编辑沟通草稿" })).toBeNull();
  const modal = screen.getByTestId("bottom-sheet-modal");
  fireEvent(modal, "show");
  expect(onInitialFocus).toHaveBeenCalledTimes(1);
  fireEvent(screen.getByTestId("bottom-sheet-panel"), "accessibilityEscape");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("supports a non-dismissible reading sheet without exposing a skip action", () => {
  const onClose = jest.fn();
  const focus = jest.spyOn(AccessibilityInfo, "setAccessibilityFocus").mockImplementation(jest.fn());
  let resolvedFocusTarget: { role?: unknown; text?: unknown } = {};
  const resolveFocusHandle = jest.fn((target) => {
    const textTarget = target as Text | null;
    resolvedFocusTarget = {
      role: textTarget?.props.accessibilityRole,
      text: textTarget?.props.children,
    };
    return 84;
  });
  render(
    <BottomSheet dismissible={false} onClose={onClose} resolveFocusHandle={resolveFocusHandle} title="欢迎来到内界 CAVE" visible>
      <Text>必读内容</Text>
    </BottomSheet>,
  );

  expect(screen.queryByRole("button", { name: "关闭欢迎来到内界 CAVE" })).toBeNull();
  fireEvent(screen.getByTestId("bottom-sheet-modal"), "show");
  expect(resolveFocusHandle).toHaveBeenCalledTimes(1);
  expect(resolvedFocusTarget).toEqual({ role: "header", text: "欢迎来到内界 CAVE" });
  expect(focus).toHaveBeenCalledWith(84);

  fireEvent(screen.getByTestId("bottom-sheet-modal"), "requestClose");
  fireEvent(screen.getByTestId("bottom-sheet-panel"), "accessibilityEscape");
  expect(onClose).not.toHaveBeenCalled();
});

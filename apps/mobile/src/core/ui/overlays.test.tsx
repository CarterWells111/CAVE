import { fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Text, type View } from "react-native";

import { BottomSheet } from "./bottom-sheet";

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
  render(<BottomSheet onClose={onClose} resolveFocusHandle={() => 42} title="来源" visible />);
  fireEvent(screen.getByTestId("bottom-sheet-modal"), "show");
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

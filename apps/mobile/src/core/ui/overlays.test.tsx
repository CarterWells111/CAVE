import { fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, findNodeHandle, Text } from "react-native";

import { BottomSheet } from "./bottom-sheet";
import { SourceDrawer } from "./source-drawer";

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
  rerender(<BottomSheet onClose={jest.fn()} onInitialFocus={onInitialFocus} onRestoreFocus={onRestoreFocus} title="来源" visible={false} />);
  expect(onRestoreFocus).toHaveBeenCalledTimes(1);
});

test("BottomSheet moves initial accessibility focus to close and supports accessibility escape", () => {
  const onClose = jest.fn();
  const focus = jest.spyOn(AccessibilityInfo, "setAccessibilityFocus").mockImplementation(jest.fn());
  jest.spyOn(require("react-native"), "findNodeHandle").mockReturnValue(42);
  render(<BottomSheet onClose={onClose} title="来源" visible />);
  fireEvent(screen.getByTestId("bottom-sheet-modal"), "show");
  expect(focus).toHaveBeenCalledWith(42);
  fireEvent(screen.getByTestId("bottom-sheet-panel"), "accessibilityEscape");
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(findNodeHandle).toBeDefined();
});

test("BottomSheet uses bottom safe-area insets and disables motion when requested", () => {
  render(<BottomSheet onClose={jest.fn()} reducedMotion title="来源" visible />);
  expect(screen.getByTestId("bottom-sheet-modal")).toHaveProp("animationType", "none");
  expect(screen.getByTestId("bottom-sheet-safe-area")).toHaveProp("edges", {
    bottom: "additive", left: "off", right: "off", top: "off",
  });
});

test("SourceDrawer presents metadata and invokes only the passed user action", () => {
  const onAction = jest.fn();
  render(
    <SourceDrawer actionLabel="在浏览器中打开" institution="世界卫生组织" onAction={onAction} onClose={jest.fn()} title="来源与医学说明" updatedAt="访问于 2026-08-27" visible />,
  );
  expect(screen.getByText("世界卫生组织")).toBeTruthy();
  expect(screen.getByText("访问于 2026-08-27")).toBeTruthy();
  expect(onAction).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "在浏览器中打开" }));
  expect(onAction).toHaveBeenCalledTimes(1);
});

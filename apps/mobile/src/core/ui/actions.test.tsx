import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { theme } from "../design/theme";
import { SecondaryButton } from "./secondary-button";
import { StickyActionBar } from "./sticky-action-bar";
import { TextAction } from "./text-action";

test("SecondaryButton has a 48-point bordered target and explicit disabled/loading semantics", () => {
  const onPress = jest.fn();
  const { rerender } = render(<SecondaryButton disabled label="稍后再看" onPress={onPress} />);
  const disabled = screen.getByRole("button", { name: "稍后再看" });
  expect(disabled).toHaveStyle({ minHeight: 48, minWidth: 44, width: "100%" });
  expect(disabled).toHaveProp("accessibilityState", { busy: false, disabled: true });
  expect(screen.getByText("不可用")).toBeTruthy();
  fireEvent.press(disabled);
  expect(onPress).not.toHaveBeenCalled();

  rerender(<SecondaryButton label="保存" loading onPress={onPress} />);
  expect(screen.getByText("加载中")).toBeTruthy();
  expect(screen.getByRole("button", { name: "保存" })).toHaveProp(
    "accessibilityState", { busy: true, disabled: true },
  );
});

test("SecondaryButton uses the 3:1 interactive border in its default state", () => {
  render(<SecondaryButton label="稍后再看" onPress={jest.fn()} />);
  expect(screen.getByRole("button", { name: "稍后再看" })).toHaveStyle({
    borderColor: theme.color.interactiveBorder,
    borderWidth: 1,
  });
});

test("SecondaryButton and TextAction expose the approved focus treatment", () => {
  render(<><SecondaryButton label="返回" onPress={jest.fn()} /><TextAction label="来源与说明" onPress={jest.fn()} underlined /></>);
  for (const label of ["返回", "来源与说明"]) {
    const action = screen.getByRole("button", { name: label });
    fireEvent(action, "focus");
    expect(action).toHaveStyle({ outlineColor: theme.color.focus, outlineOffset: 2, outlineWidth: 2 });
  }
  expect(screen.getByText("来源与说明")).toHaveStyle({ textDecorationLine: "underline" });
});

test("TextAction remains discoverable with a 44-point target and blocks disabled activation", () => {
  const onPress = jest.fn();
  render(<TextAction disabled label="暂时不回答" onPress={onPress} />);
  const action = screen.getByRole("button", { name: "暂时不回答" });
  expect(action).toHaveStyle({ minHeight: 44, minWidth: 44 });
  expect(action).toHaveProp("accessibilityState", { busy: false, disabled: true });
  expect(screen.getByText("不可用")).toBeTruthy();
  fireEvent.press(action);
  expect(onPress).not.toHaveBeenCalled();
});

test("TextAction blocks loading activation with busy semantics and visible status", () => {
  const onPress = jest.fn();
  render(<TextAction label="复制文字" loading onPress={onPress} />);
  const action = screen.getByRole("button", { name: "复制文字" });
  expect(action).toHaveProp("accessibilityState", { busy: true, disabled: true });
  expect(screen.getByText("加载中")).toBeTruthy();
  fireEvent.press(action);
  expect(onPress).not.toHaveBeenCalled();
});

test("StickyActionBar provides a raised continuous surface without swallowing child semantics", () => {
  render(<StickyActionBar testID="sticky"><Text>操作</Text></StickyActionBar>);
  expect(screen.getByTestId("sticky")).toHaveStyle({
    backgroundColor: theme.color.canvasRaised,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: "100%",
  });
  expect(screen.getByText("操作")).toBeTruthy();
  expect(screen.getByTestId("sticky-safe-area")).toHaveProp("edges", {
    bottom: "additive", left: "off", right: "off", top: "off",
  });
});

test("StickyActionSpacer exposes the minimum content inset that prevents action overlap", () => {
  const { StickyActionSpacer, STICKY_ACTION_BAR_CONTENT_INSET } = require("./sticky-action-bar") as typeof import("./sticky-action-bar");
  render(<StickyActionSpacer bottomInset={12} testID="spacer" />);
  expect(STICKY_ACTION_BAR_CONTENT_INSET).toBe(76);
  expect(screen.getByTestId("spacer")).toHaveStyle({ height: 88 });
});

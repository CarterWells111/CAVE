import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { darkTheme } from "../../../core/design/theme";
import { LongTermBottomNav } from "./LongTermBottomNav";

test("renders four compact vector destinations with color and icon size as the only selected emphasis", () => {
  const navigate = jest.fn();
  render(<LongTermBottomNav activeTab="reviews" navigate={navigate} />);

  const tabs = screen.getAllByRole("tab");
  expect(tabs).toHaveLength(4);
  expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual(["首页", "回顾", "练习", "我的"]);

  const selectedTab = screen.getByRole("tab", { name: "回顾" });
  const inactiveTab = screen.getByRole("tab", { name: "首页" });
  expect(selectedTab.props.accessibilityState).toEqual({ disabled: false, selected: true });
  expect(inactiveTab.props.accessibilityState).toEqual({ disabled: false, selected: false });
  expect(StyleSheet.flatten(selectedTab.props.style)).toEqual(expect.objectContaining({
    backgroundColor: darkTheme.color.surface,
    borderWidth: 0,
  }));
  expect(StyleSheet.flatten(inactiveTab.props.style)).toEqual(expect.objectContaining({
    backgroundColor: darkTheme.color.surface,
    borderWidth: 0,
  }));
  expect(screen.getByText("time-outline")).toHaveProp("color", darkTheme.color.primary);
  expect(screen.getByText("time-outline")).toHaveProp("size", 24);
  expect(screen.getByText("home-outline")).toHaveProp("color", darkTheme.color.textSecondary);
  expect(screen.getByText("home-outline")).toHaveProp("size", 20);
  expect(screen.queryByText("当前")).toBeNull();

  fireEvent.press(screen.getByRole("tab", { name: "我的" }));
  expect(navigate).toHaveBeenCalledWith("profile");
});

test("keeps every destination touchable at 44 by 44 and supports no active tab", () => {
  render(<LongTermBottomNav navigate={jest.fn()} />);

  expect(screen.getByTestId("long-term-bottom-nav-safe-area")).toHaveProp(
    "edges",
    expect.objectContaining({ bottom: "additive" }),
  );
  expect(StyleSheet.flatten(screen.getByTestId("long-term-bottom-nav-content").props.style)).toEqual(
    expect.objectContaining({ height: 48, paddingVertical: 0 }),
  );
  for (const tab of screen.getAllByRole("tab")) {
    expect(StyleSheet.flatten(tab.props.style)).toEqual(expect.objectContaining({ minHeight: 44, minWidth: 44 }));
    expect(tab.props.accessibilityState).toEqual({ disabled: false, selected: false });
  }
  expect(screen.queryByText("当前")).toBeNull();
});

test("keeps all long-term destinations visible but inert while journey navigation is locked", () => {
  const navigate = jest.fn();
  render(<LongTermBottomNav disabled navigate={navigate} />);

  for (const tab of screen.getAllByRole("tab")) {
    expect(tab).toHaveProp("accessibilityState", expect.objectContaining({ disabled: true }));
    fireEvent.press(tab);
  }
  expect(navigate).not.toHaveBeenCalled();
});

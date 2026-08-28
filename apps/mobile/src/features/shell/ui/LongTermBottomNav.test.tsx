import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { LongTermBottomNav } from "./LongTermBottomNav";

test("renders exactly four long-term destinations with an explicit current state", () => {
  const navigate = jest.fn();
  render(<LongTermBottomNav activeTab="reviews" navigate={navigate} />);

  const tabs = screen.getAllByRole("tab");
  expect(tabs).toHaveLength(4);
  expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual(["首页", "回顾", "练习", "草稿"]);
  expect(screen.queryByRole("tab", { name: "我的" })).toBeNull();

  expect(screen.getByRole("tab", { name: "回顾" }).props.accessibilityState).toEqual({ selected: true });
  expect(screen.getByRole("tab", { name: "首页" }).props.accessibilityState).toEqual({ selected: false });
  expect(screen.getByText("当前")).toBeTruthy();

  fireEvent.press(screen.getByRole("tab", { name: "草稿" }));
  expect(navigate).toHaveBeenCalledWith("cards");
});

test("keeps every destination touchable at 44 by 44 and supports no active tab", () => {
  render(<LongTermBottomNav navigate={jest.fn()} />);

  for (const tab of screen.getAllByRole("tab")) {
    expect(StyleSheet.flatten(tab.props.style)).toEqual(expect.objectContaining({ minHeight: 44, minWidth: 44 }));
    expect(tab.props.accessibilityState).toEqual({ selected: false });
  }
  expect(screen.queryByText("当前")).toBeNull();
});

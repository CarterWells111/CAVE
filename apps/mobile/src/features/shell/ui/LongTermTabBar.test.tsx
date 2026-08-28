import { fireEvent, render, screen } from "@testing-library/react-native";

import { LongTermTabBar } from "./LongTermTabBar";

const routes = [
  { key: "home-key", name: "index" },
  { key: "reviews-key", name: "reviews" },
  { key: "practice-key", name: "practice" },
  { key: "cards-key", name: "cards" },
] as const;

test("renders the shared navigation with the Expo tab selection and navigation behavior", () => {
  const emitTabPress = jest.fn(() => ({ defaultPrevented: false }));
  const navigate = jest.fn();

  render(
    <LongTermTabBar
      emitTabPress={emitTabPress}
      navigate={navigate}
      state={{ index: 1, routes }}
    />,
  );

  expect(screen.getByRole("tab", { name: "回顾" }).props.accessibilityState).toEqual({ selected: true });
  expect(screen.getByText("⌂")).toBeTruthy();
  expect(screen.getByText("↺")).toBeTruthy();
  expect(screen.getByText("◇")).toBeTruthy();
  expect(screen.getByText("▤")).toBeTruthy();

  fireEvent.press(screen.getByRole("tab", { name: "卡片" }));

  expect(emitTabPress).toHaveBeenCalledWith("cards-key");
  expect(navigate).toHaveBeenCalledWith("cards");
});

test("emits current and prevented tab presses without navigating", () => {
  const emitTabPress = jest
    .fn()
    .mockReturnValueOnce({ defaultPrevented: false })
    .mockReturnValueOnce({ defaultPrevented: true });
  const navigate = jest.fn();

  render(
    <LongTermTabBar
      emitTabPress={emitTabPress}
      navigate={navigate}
      state={{ index: 1, routes }}
    />,
  );

  fireEvent.press(screen.getByRole("tab", { name: "回顾" }));
  fireEvent.press(screen.getByRole("tab", { name: "卡片" }));

  expect(emitTabPress.mock.calls).toEqual([["reviews-key"], ["cards-key"]]);
  expect(navigate).not.toHaveBeenCalled();
});

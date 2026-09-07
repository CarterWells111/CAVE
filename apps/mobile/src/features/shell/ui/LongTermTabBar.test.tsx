import { fireEvent, render, screen } from "@testing-library/react-native";

import { LongTermTabBar } from "./LongTermTabBar";

const routes = [
  { key: "home-key", name: "index" },
  { key: "reviews-key", name: "ai" },
  { key: "practice-key", name: "practice" },
  { key: "journal-key", name: "journal" },
  { key: "profile-key", name: "profile" },
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

  expect(screen.getByRole("tab", { name: "AI" }).props.accessibilityState).toEqual(
    expect.objectContaining({ disabled: false, selected: true }),
  );
  expect(screen.getAllByRole("tab").map((tab) => tab.props.accessibilityLabel)).toEqual([
    "旅程",
    "内界手记",
    "AI",
    "我的",
  ]);
  expect(screen.queryByRole("tab", { name: "练习" })).toBeNull();
  expect(screen.getByText("book-outline")).toBeTruthy();
  expect(screen.queryByText("chatbubbles-outline")).toBeNull();
  expect(screen.getByText("sparkles-outline")).toBeTruthy();
  expect(screen.getByText("person-outline")).toBeTruthy();

  fireEvent.press(screen.getByRole("tab", { name: "我的" }));

  expect(emitTabPress).toHaveBeenCalledWith("profile-key");
  expect(navigate).toHaveBeenCalledWith("profile");
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

  fireEvent.press(screen.getByRole("tab", { name: "AI" }));
  fireEvent.press(screen.getByRole("tab", { name: "内界手记" }));

  expect(emitTabPress.mock.calls).toEqual([["reviews-key"], ["journal-key"]]);
  expect(navigate).not.toHaveBeenCalled();
});

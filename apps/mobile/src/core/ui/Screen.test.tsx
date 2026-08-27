import { render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";

import { Screen, type ScreenProps } from "./Screen";

type LockedScrollKey = Extract<
  keyof ScreenProps,
  "horizontal" | "contentInsetAdjustmentBehavior" | "keyboardShouldPersistTaps"
>;

const screenPropsLockScrollInvariants: [LockedScrollKey] extends [never] ? true : false = true;

describe("Screen", () => {
  it("provides a responsive vertical scrolling content container", () => {
    render(
      <Screen testID="screen">
        <Text>正文</Text>
      </Screen>,
    );

    const root = screen.getByTestId("screen");
    const rootStyle = StyleSheet.flatten(root.props.style);
    const contentStyle = StyleSheet.flatten(root.props.contentContainerStyle);

    expect(root).toHaveProp("horizontal", false);
    expect(root).toHaveProp("contentInsetAdjustmentBehavior", "automatic");
    expect(root).toHaveProp("keyboardShouldPersistTaps", "handled");
    expect(rootStyle).toEqual(expect.objectContaining({ flex: 1 }));
    expect(contentStyle).toEqual(
      expect.objectContaining({
        alignSelf: "center",
        flexGrow: 1,
        width: "100%",
      }),
    );
    expect(contentStyle.maxWidth).toBeGreaterThan(0);
    expect(contentStyle.paddingHorizontal).toBeGreaterThan(0);
    expect(contentStyle.paddingVertical).toBeGreaterThan(0);
    expect(contentStyle.gap).toBeGreaterThan(0);
  });

  it("passes caller-supplied test and accessibility props to the scroll view", () => {
    render(
      <Screen
        testID="accessible-screen"
        accessibilityLabel="练习内容"
        accessibilityHint="上下滑动浏览"
      >
        <Text>正文</Text>
      </Screen>,
    );

    expect(screen.getByTestId("accessible-screen")).toEqual(
      expect.objectContaining({
        props: expect.objectContaining({
          accessibilityLabel: "练习内容",
          accessibilityHint: "上下滑动浏览",
        }),
      }),
    );
  });

  it("locks scroll invariants out of its public props", () => {
    expect(screenPropsLockScrollInvariants).toBe(true);
  });

  it("lets accepted caller styles override the base presentation", () => {
    render(
      <Screen
        testID="custom-screen"
        style={{ backgroundColor: "papayawhip", flex: 0 }}
        contentContainerStyle={{ gap: 3, maxWidth: 320, paddingHorizontal: 7 }}
      >
        <Text>正文</Text>
      </Screen>,
    );

    const root = screen.getByTestId("custom-screen");

    expect(StyleSheet.flatten(root.props.style)).toEqual(
      expect.objectContaining({ backgroundColor: "papayawhip", flex: 0 }),
    );
    expect(StyleSheet.flatten(root.props.contentContainerStyle)).toEqual(
      expect.objectContaining({ gap: 3, maxWidth: 320, paddingHorizontal: 7 }),
    );
    expect(root).toHaveProp("horizontal", false);
    expect(root).toHaveProp("contentInsetAdjustmentBehavior", "automatic");
    expect(root).toHaveProp("keyboardShouldPersistTaps", "handled");
  });
});

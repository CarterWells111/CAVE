import { render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";

import { contentHorizontalPadding, Screen, type ScreenProps } from "./Screen";

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
    expect(screen.queryByTestId("screen-safe-area")).toBeNull();
    const rootStyle = StyleSheet.flatten(root.props.style);
    const contentStyle = StyleSheet.flatten(root.props.contentContainerStyle);

    expect(root).toHaveProp("horizontal", false);
    expect(root).toHaveProp("contentInsetAdjustmentBehavior", "automatic");
    expect(root).toHaveProp("keyboardShouldPersistTaps", "handled");
    expect(root).toHaveProp("automaticallyAdjustKeyboardInsets", true);
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

  it("uses 16-point gutters at 360 points and preserves the 600-point reading width", () => {
    render(<Screen testID="small-screen"><Text>放大正文</Text></Screen>);
    const contentStyle = StyleSheet.flatten(screen.getByTestId("small-screen").props.contentContainerStyle);
    expect(contentHorizontalPadding(360)).toBe(16);
    expect(contentHorizontalPadding(320)).toBe(16);
    expect(contentHorizontalPadding(390)).toBe(20);
    expect(contentStyle.maxWidth).toBe(600);
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

  it("lets caller presentation styles through without overriding readable width or gutters", () => {
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
      expect.objectContaining({ gap: 3, maxWidth: 600, paddingHorizontal: 20 }),
    );
    expect(root).toHaveProp("horizontal", false);
    expect(root).toHaveProp("contentInsetAdjustmentBehavior", "automatic");
    expect(root).toHaveProp("keyboardShouldPersistTaps", "handled");
  });

  it("strips edge-specific and width aliases that could bypass content invariants", () => {
    render(
      <Screen
        contentContainerStyle={{ maxWidth: 200, minWidth: 900, paddingLeft: 0, paddingRight: 0, width: 900 }}
        testID="locked-screen"
      >
        <Text>正文</Text>
      </Screen>,
    );
    const content = StyleSheet.flatten(screen.getByTestId("locked-screen").props.contentContainerStyle);
    expect(content).toEqual(expect.objectContaining({ maxWidth: 600, paddingHorizontal: 20, width: "100%" }));
    expect(content.minWidth).toBeUndefined();
    expect(content.paddingLeft).toBeUndefined();
    expect(content.paddingRight).toBeUndefined();
  });
});

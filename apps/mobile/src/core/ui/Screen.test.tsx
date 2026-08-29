import { createRef, type ComponentRef } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  contentHorizontalPadding,
  safeContentEdgePadding,
  Screen,
  type ScreenProps,
  useScreenScroll,
} from "./Screen";

type LockedScrollKey = Extract<
  keyof ScreenProps,
  | "automaticallyAdjustContentInsets"
  | "contentInsetAdjustmentBehavior"
  | "horizontal"
  | "keyboardShouldPersistTaps"
>;

const screenPropsLockScrollInvariants: [LockedScrollKey] extends [never] ? true : false = true;

function StandaloneScrollAction() {
  const { scrollToTop } = useScreenScroll();
  return <Pressable accessibilityRole="button" onPress={scrollToTop}><Text>回到顶部</Text></Pressable>;
}

describe("Screen", () => {
  it("provides a responsive vertical scrolling content container", () => {
    render(
      <Screen testID="screen">
        <Text>正文</Text>
      </Screen>,
    );

    const root = screen.getByTestId("screen");
    expect(screen.queryByTestId("screen-safe-area")).toBeNull();
    expect(screen.getByTestId("screen-container")).toHaveStyle({ flex: 1 });
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

  it("keeps a fixed header outside the vertical scroll view", () => {
    render(
      <Screen fixedHeader={<Text>固定页眉</Text>} testID="fixed-header-screen">
        <Text>可滚动正文</Text>
      </Screen>,
    );

    const fixedHeader = screen.getByTestId("screen-fixed-header");
    const scrollView = screen.getByTestId("fixed-header-screen");

    expect(within(fixedHeader).getByText("固定页眉")).toBeTruthy();
    expect(within(scrollView).queryByText("固定页眉")).toBeNull();
    expect(within(scrollView).getByText("可滚动正文")).toBeTruthy();
    expect(StyleSheet.flatten(fixedHeader.props.style)).toEqual(
      expect.objectContaining({
        maxWidth: 600,
        paddingHorizontal: 20,
        width: "100%",
      }),
    );
  });

  it("keeps every fixed header below the top system inset with stable shared spacing", () => {
    const originalScreen = Dimensions.get("screen");
    const originalWindow = Dimensions.get("window");
    Dimensions.set({
      screen: { ...originalScreen, height: 844, width: 390 },
      window: { ...originalWindow, height: 844, width: 390 },
    });
    const metrics = {
      frame: { height: 844, width: 390, x: 0, y: 0 },
      insets: { bottom: 34, left: 0, right: 0, top: 47 },
    };
    const view = render(
      <SafeAreaProvider initialMetrics={metrics}>
        <Screen fixedHeader={<Text>第一页导航</Text>} testID="first-page" />
      </SafeAreaProvider>,
    );
    try {
      expect(screen.getByTestId("screen-fixed-header")).toHaveStyle({ paddingTop: 71 });

      view.rerender(
        <SafeAreaProvider initialMetrics={metrics}>
          <Screen fixedHeader={<Text>第二页导航</Text>} testID="second-page" />
        </SafeAreaProvider>,
      );
      expect(screen.getByTestId("screen-fixed-header")).toHaveStyle({ paddingTop: 71 });
      act(() => {
        Dimensions.set({
          screen: { ...originalScreen, height: 844, width: 390 },
          window: { ...originalWindow, height: 520, width: 390 },
        });
      });
      expect(screen.getByTestId("screen-fixed-header")).toHaveStyle({ paddingTop: 71 });
      expect(screen.queryByTestId("screen-safe-area")).toBeNull();
    } finally {
      view.unmount();
      Dimensions.set({ screen: originalScreen, window: originalWindow });
    }
  });

  it("can place standalone scroll content below the top system inset without an outer safe-area band", () => {
    render(
      <SafeAreaProvider initialMetrics={{
        frame: { height: 844, width: 390, x: 0, y: 0 },
        insets: { bottom: 34, left: 0, right: 0, top: 47 },
      }}>
        <Screen
          contentContainerStyle={{ paddingVertical: 16 }}
          contentSafeAreaTop
          testID="safe-content-screen"
        >
          <Text>品牌引导</Text>
        </Screen>
      </SafeAreaProvider>,
    );

    const contentStyle = StyleSheet.flatten(
      screen.getByTestId("safe-content-screen").props.contentContainerStyle,
    );
    expect(contentStyle.paddingVertical).toBe(16);
    expect(contentStyle.paddingTop).toBe(63);
    expect(contentStyle.paddingBottom).toBe(42);
    expect(screen.getByTestId("safe-content-screen")).toHaveProp(
      "contentInsetAdjustmentBehavior",
      "never",
    );
    expect(screen.getByTestId("safe-content-screen")).toHaveProp(
      "automaticallyAdjustContentInsets",
      false,
    );
    expect(screen.queryByTestId("screen-safe-area")).toBeNull();
  });

  it("keeps Android content below tall cutouts without adding redundant ordinary spacing", () => {
    expect(safeContentEdgePadding(32, 24, "minimum")).toBe(32);
    expect(safeContentEdgePadding(16, 40, "minimum")).toBe(48);
    expect(safeContentEdgePadding(0, 0, "minimum")).toBe(0);
    expect(safeContentEdgePadding(16, 47, "additive")).toBe(63);
  });

  it("uses physical screen height when a fixed-header route mounts while the keyboard has shrunk the window", () => {
    const originalScreen = Dimensions.get("screen");
    const originalWindow = Dimensions.get("window");
    Dimensions.set({
      screen: { ...originalScreen, height: 844, width: 390 },
      window: { ...originalWindow, height: 520, width: 390 },
    });
    const view = render(
      <SafeAreaProvider initialMetrics={{
        frame: { height: 844, width: 390, x: 0, y: 0 },
        insets: { bottom: 34, left: 0, right: 0, top: 47 },
      }}>
        <Screen fixedHeader={<Text>键盘切页后的导航</Text>} testID="keyboard-remount-screen" />
      </SafeAreaProvider>,
    );
    try {
      expect(screen.getByTestId("screen-fixed-header")).toHaveStyle({ paddingTop: 71 });
    } finally {
      view.unmount();
      Dimensions.set({ screen: originalScreen, window: originalWindow });
    }
  });

  it.each([
    { height: 667, safeTop: 20, expectedPaddingTop: 36 },
    { height: 932, safeTop: 59, expectedPaddingTop: 91 },
  ])("adapts fixed-header spacing for a $height-point phone", ({ expectedPaddingTop, height, safeTop }) => {
    const originalScreen = Dimensions.get("screen");
    const originalWindow = Dimensions.get("window");
    Dimensions.set({
      screen: { ...originalScreen, height, width: 390 },
      window: { ...originalWindow, height, width: 390 },
    });
    const view = render(
      <SafeAreaProvider initialMetrics={{
        frame: { height, width: 390, x: 0, y: 0 },
        insets: { bottom: 0, left: 0, right: 0, top: safeTop },
      }}>
        <Screen fixedHeader={<Text>旅程导航</Text>} testID="responsive-header-screen" />
      </SafeAreaProvider>,
    );
    try {
      expect(screen.getByTestId("screen-fixed-header")).toHaveStyle({ paddingTop: expectedPaddingTop });
    } finally {
      view.unmount();
      Dimensions.set({ screen: originalScreen, window: originalWindow });
    }
  });

  it("locks scroll invariants out of its public props", () => {
    expect(screenPropsLockScrollInvariants).toBe(true);
  });

  it("forwards a ref to the native scroll view", () => {
    const ref = createRef<ComponentRef<typeof ScrollView>>();

    render(<Screen ref={ref} testID="ref-screen"><Text>正文</Text></Screen>);

    expect(ref.current).not.toBeNull();
    expect(ref.current?.props.testID).toBe("ref-screen");
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

  it("keeps the scroll controller safe when a consumer is rendered outside Screen", () => {
    render(<StandaloneScrollAction />);

    expect(() => fireEvent.press(screen.getByRole("button", { name: "回到顶部" }))).not.toThrow();
  });

  it("retains a native inner-view ref for measuring automatic scroll targets", () => {
    render(<Screen testID="measurable-screen"><Text>自动滚动目标</Text></Screen>);

    expect(screen.getByTestId("measurable-screen").props.innerViewRef).toEqual(
      expect.objectContaining({ current: null }),
    );
  });
});

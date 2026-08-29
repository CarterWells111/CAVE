import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ComponentRef,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { ScrollView, StyleSheet, type ScrollViewProps, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../design/theme-provider";
import { space } from "../design/tokens";

type LockedScrollProp = "horizontal" | "contentInsetAdjustmentBehavior" | "keyboardShouldPersistTaps";

export type ScreenProps = Omit<ScrollViewProps, LockedScrollProp> & {
  fixedHeader?: ReactNode;
  scrollResetKey?: string | number | boolean;
};

export type ScreenScrollController = Readonly<{
  scrollToNode(node: View, animated: boolean): void;
  scrollToTop(): void;
}>;

const fallbackScrollController: ScreenScrollController = Object.freeze({
  scrollToNode: () => undefined,
  scrollToTop: () => undefined,
});

const ScreenScrollContext = createContext<ScreenScrollController>(fallbackScrollController);

export function useScreenScroll(): ScreenScrollController {
  return useContext(ScreenScrollContext);
}

function ScreenScrollProvider({
  children,
  controller,
}: PropsWithChildren<{ controller: ScreenScrollController }>) {
  return <ScreenScrollContext.Provider value={controller}>{children}</ScreenScrollContext.Provider>;
}

export function contentHorizontalPadding(width: number): number {
  return width < 375 ? space.md : space.card;
}

export const Screen = forwardRef<ComponentRef<typeof ScrollView>, ScreenProps>(function Screen(
  { children, contentContainerStyle, fixedHeader, scrollResetKey, style, ...props },
  forwardedRef,
) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const innerViewRef = useRef<View>(null!);
  const horizontalPadding = contentHorizontalPadding(width);
  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ animated: false, y: 0 });
  }, []);
  const scrollToNode = useCallback((node: View, animated: boolean) => {
    requestAnimationFrame(() => {
      const scrollView = scrollRef.current;
      const innerViewNode = innerViewRef.current;
      if (!scrollView || !innerViewNode) return;
      node.measureLayout(
        innerViewNode,
        (_left, top) => scrollView.scrollTo({ animated, y: top }),
        () => undefined,
      );
    });
  }, []);
  const scrollController = useMemo<ScreenScrollController>(
    () => ({ scrollToNode, scrollToTop }),
    [scrollToNode, scrollToTop],
  );
  useImperativeHandle(forwardedRef, () => scrollRef.current as ComponentRef<typeof ScrollView>);
  const callerPresentation = { ...(StyleSheet.flatten(contentContainerStyle) ?? {}) };
  for (const lockedKey of [
    "maxWidth", "minWidth", "width", "paddingHorizontal", "paddingLeft", "paddingRight", "paddingStart", "paddingEnd",
  ] as const) {
    delete callerPresentation[lockedKey];
  }

  useEffect(() => {
    if (scrollResetKey !== undefined) scrollRef.current?.scrollTo({ animated: false, y: 0 });
  }, [scrollResetKey]);

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ backgroundColor: theme.color.background, flex: 1 }}
      testID="screen-safe-area"
    >
      {fixedHeader ? (
        <View
          style={{
            alignSelf: "center",
            backgroundColor: theme.color.background,
            maxWidth: theme.size.readableContentMax,
            paddingBottom: theme.space.sm,
            paddingHorizontal: horizontalPadding,
            paddingTop: theme.space.compact,
            width: "100%",
            zIndex: 1,
          }}
          testID="screen-fixed-header"
        >
          {fixedHeader}
        </View>
      ) : null}
      <ScrollView
        {...props}
        innerViewRef={innerViewRef}
        ref={scrollRef}
      automaticallyAdjustKeyboardInsets
      horizontal={false}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={[{ flex: 1, backgroundColor: theme.color.background }, style]}
      contentContainerStyle={[
        {
          alignSelf: "center",
          flexGrow: 1,
          gap: theme.space.lg,
          paddingVertical: theme.space.xl,
        },
        callerPresentation,
        {
          maxWidth: theme.size.readableContentMax,
          paddingHorizontal: horizontalPadding,
          width: "100%",
        },
      ]}
    >
        <ScreenScrollProvider controller={scrollController}>{children}</ScreenScrollProvider>
      </ScrollView>
    </SafeAreaView>
  );
});

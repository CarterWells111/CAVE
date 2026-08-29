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
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { useTheme } from "../design/theme-provider";
import { space } from "../design/tokens";

type LockedScrollProp =
  | "automaticallyAdjustContentInsets"
  | "contentInsetAdjustmentBehavior"
  | "horizontal"
  | "keyboardShouldPersistTaps";

export type ScreenProps = Omit<ScrollViewProps, LockedScrollProp> & {
  contentSafeAreaTop?: boolean;
  fixedHeader?: ReactNode;
  scrollResetKey?: string | number | boolean;
};

export type ScreenScrollController = Readonly<{
  scrollToTop(): void;
}>;

const fallbackScrollController: ScreenScrollController = Object.freeze({
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

export function safeContentTopPadding(
  contentPadding: number,
  safeAreaTop: number,
  mode: "additive" | "minimum",
): number {
  return mode === "additive"
    ? contentPadding + safeAreaTop
    : Math.max(contentPadding, safeAreaTop + space.sm);
}

function fixedHeaderTopGap(height: number): number {
  if (height < 700) return space.md;
  if (height < 900) return space.lg;
  return space.xl;
}

export const Screen = forwardRef<ComponentRef<typeof ScrollView>, ScreenProps>(function Screen(
  {
    children,
    contentContainerStyle,
    contentSafeAreaTop = false,
    fixedHeader,
    scrollResetKey,
    style,
    ...props
  },
  forwardedRef,
) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const safeAreaTop = useContext(SafeAreaInsetsContext)?.top ?? 0;
  const scrollRef = useRef<ScrollView>(null);
  const horizontalPadding = contentHorizontalPadding(width);
  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ animated: false, y: 0 });
  }, []);
  const scrollController = useMemo<ScreenScrollController>(() => ({ scrollToTop }), [scrollToTop]);
  useImperativeHandle(forwardedRef, () => scrollRef.current as ComponentRef<typeof ScrollView>);
  const callerPresentation = { ...(StyleSheet.flatten(contentContainerStyle) ?? {}) };
  for (const lockedKey of [
    "maxWidth", "minWidth", "width", "paddingHorizontal", "paddingLeft", "paddingRight", "paddingStart", "paddingEnd",
  ] as const) {
    delete callerPresentation[lockedKey];
  }
  const requestedContentTopPadding = callerPresentation.paddingTop
    ?? callerPresentation.paddingVertical
    ?? theme.space.xl;
  const contentTopPadding = typeof requestedContentTopPadding === "number"
    ? requestedContentTopPadding
    : theme.space.xl;
  const manuallyInsetContent = contentSafeAreaTop
    ? safeContentTopPadding(contentTopPadding, safeAreaTop, "additive")
    : fixedHeader === undefined && process.env.EXPO_OS === "android"
      ? safeContentTopPadding(contentTopPadding, safeAreaTop, "minimum")
      : undefined;

  useEffect(() => {
    if (scrollResetKey !== undefined) scrollRef.current?.scrollTo({ animated: false, y: 0 });
  }, [scrollResetKey]);

  return (
    <View
      style={{ backgroundColor: theme.color.background, flex: 1 }}
      testID="screen-container"
    >
      {fixedHeader ? (
        <View
          style={{
            alignSelf: "center",
            backgroundColor: theme.color.background,
            maxWidth: theme.size.readableContentMax,
            paddingBottom: theme.space.sm,
            paddingHorizontal: horizontalPadding,
            paddingTop: safeAreaTop + fixedHeaderTopGap(Dimensions.get("screen").height),
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
        ref={scrollRef}
        automaticallyAdjustContentInsets={!contentSafeAreaTop}
        automaticallyAdjustKeyboardInsets
        horizontal={false}
        contentInsetAdjustmentBehavior={contentSafeAreaTop ? "never" : "automatic"}
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
          manuallyInsetContent === undefined ? null : { paddingTop: manuallyInsetContent },
          {
            maxWidth: theme.size.readableContentMax,
            paddingHorizontal: horizontalPadding,
            width: "100%",
          },
        ]}
      >
        <ScreenScrollProvider controller={scrollController}>{children}</ScreenScrollProvider>
      </ScrollView>
    </View>
  );
});

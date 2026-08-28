import { ScrollView, StyleSheet, type ScrollViewProps, useWindowDimensions } from "react-native";

import { useTheme } from "../design/theme-provider";
import { space } from "../design/tokens";

type LockedScrollProp = "horizontal" | "contentInsetAdjustmentBehavior" | "keyboardShouldPersistTaps";

export type ScreenProps = Omit<ScrollViewProps, LockedScrollProp>;

export function contentHorizontalPadding(width: number): number {
  return width < 375 ? space.md : space.card;
}

export function Screen({ children, contentContainerStyle, style, ...props }: ScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const horizontalPadding = contentHorizontalPadding(width);
  const callerPresentation = { ...(StyleSheet.flatten(contentContainerStyle) ?? {}) };
  for (const lockedKey of [
    "maxWidth", "minWidth", "width", "paddingHorizontal", "paddingLeft", "paddingRight", "paddingStart", "paddingEnd",
  ] as const) {
    delete callerPresentation[lockedKey];
  }

  return (
    <ScrollView
      {...props}
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
      {children}
    </ScrollView>
  );
}

import type { PropsWithChildren } from "react";
import { View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "../design/theme";

export const STICKY_ACTION_BAR_CONTENT_INSET = 76;

export function StickyActionSpacer({ bottomInset = 0, style, ...props }: ViewProps & { bottomInset?: number }) {
  return <View {...props} style={[{ height: STICKY_ACTION_BAR_CONTENT_INSET + bottomInset }, style]} />;
}

export function StickyActionBar({ children, style, ...props }: PropsWithChildren<ViewProps>) {
  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{ backgroundColor: theme.color.canvasRaised }}
      testID="sticky-safe-area"
    >
      <View
        {...props}
        style={[
          {
            backgroundColor: theme.color.canvasRaised,
            borderCurve: "continuous",
            borderTopColor: theme.color.borderSoft,
            borderTopLeftRadius: theme.radius.sheet,
            borderTopRightRadius: theme.radius.sheet,
            borderTopWidth: theme.border.width,
            gap: theme.space.compact,
            paddingBottom: theme.space.card,
            paddingHorizontal: theme.space.card,
            paddingTop: theme.space.md,
            width: "100%",
          },
          style,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

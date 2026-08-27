import { ScrollView, type ScrollViewProps } from "react-native";

import { theme } from "../design/theme";

type LockedScrollProp = "horizontal" | "contentInsetAdjustmentBehavior" | "keyboardShouldPersistTaps";

export type ScreenProps = Omit<ScrollViewProps, LockedScrollProp>;

export function Screen({ children, contentContainerStyle, style, ...props }: ScreenProps) {
  return (
    <ScrollView
      {...props}
      horizontal={false}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={[{ flex: 1, backgroundColor: theme.color.background }, style]}
      contentContainerStyle={[
        {
          alignSelf: "center",
          flexGrow: 1,
          gap: theme.space.lg,
          maxWidth: theme.size.readableContentMax,
          paddingHorizontal: theme.space.lg,
          paddingVertical: theme.space.xl,
          width: "100%",
        },
        contentContainerStyle,
      ]}
    >
      {children}
    </ScrollView>
  );
}

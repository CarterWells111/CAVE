import type { Role } from "react-native";
import { StyleSheet, Text, View } from "react-native";

import { journeyColors, journeyRadii, journeySpacing } from "../journey-ui-tokens";

export type JourneyStatusBannerProps = {
  message: string;
  accessibilityLabel?: string | undefined;
  tone?: "info" | "success" | "error" | undefined;
  role?: Role | undefined;
  testID?: string | undefined;
};

export function JourneyStatusBanner({
  message,
  accessibilityLabel,
  tone = "info",
  role,
  testID
}: JourneyStatusBannerProps) {
  return (
    <View
      accessibilityLabel={accessibilityLabel ?? message}
      accessibilityLiveRegion="polite"
      accessibilityRole={role ? undefined : tone === "error" ? "alert" : "text"}
      accessible
      role={role}
      style={[styles.banner, styles[`${tone}Banner`]]}
      testID={testID}
    >
      <Text style={[styles.message, styles[`${tone}Text`]]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: journeyRadii.sm,
    paddingHorizontal: journeySpacing.md,
    paddingVertical: journeySpacing.sm
  },
  infoBanner: { backgroundColor: journeyColors.noticeBackground },
  successBanner: { backgroundColor: journeyColors.successBackground },
  errorBanner: { backgroundColor: journeyColors.errorBackground },
  message: { fontSize: 15, lineHeight: 22 },
  infoText: { color: journeyColors.noticeText },
  successText: { color: journeyColors.successText },
  errorText: { color: journeyColors.errorText }
});

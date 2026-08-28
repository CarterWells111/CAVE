import type { Role } from "react-native";
import { View } from "react-native";

import { StatusBanner } from "../../../../core/ui/StatusBanner";

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
  const needsAccessibilityAdapter = accessibilityLabel !== undefined || role !== undefined;
  const effectiveRole = role ?? (tone === "error" ? "alert" : "status");
  const liveRegion = effectiveRole === "alert" ? "assertive" : "polite";
  const banner = (
    <StatusBanner
      message={message}
      variant={tone}
      {...(!needsAccessibilityAdapter && testID !== undefined ? { testID } : {})}
    />
  );

  if (!needsAccessibilityAdapter) return banner;

  return (
    <View
      accessibilityLabel={accessibilityLabel ?? message}
      accessibilityLiveRegion={liveRegion}
      accessible
      role={effectiveRole}
      testID={testID}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {banner}
      </View>
    </View>
  );
}

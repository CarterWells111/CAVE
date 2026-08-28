import { View } from "react-native";

import { theme } from "../design/theme";

export type EchoBackgroundProps = { reducedMotion?: boolean; testID?: string };

export function EchoBackground({ reducedMotion = false, testID }: EchoBackgroundProps) {
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ bottom: 0, left: 0, overflow: "hidden", position: "absolute", right: 0, top: 0 }}
      testID={testID}
    >
      <View
        style={{
          borderColor: theme.color.brandDeep,
          borderRadius: theme.radius.pill,
          borderWidth: 2,
          height: 320,
          opacity: reducedMotion ? 0.08 : 0.12,
          position: "absolute",
          right: -140,
          top: -80,
          width: 420,
        }}
        testID="echo-layer-1"
      />
      <View
        style={{
          borderColor: theme.color.brandLavender,
          borderRadius: theme.radius.pill,
          borderWidth: 1,
          bottom: -120,
          height: 300,
          left: -130,
          opacity: 0.1,
          position: "absolute",
          width: 380,
        }}
        testID="echo-layer-2"
      />
    </View>
  );
}

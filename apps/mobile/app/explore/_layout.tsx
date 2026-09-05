import { Stack } from "expo-router";
import { View } from "react-native";

import { ExploreAccessGate } from "../../src/features/shell/ui/explore-access-gate";
import { JourneyLongTermNav } from "../../src/features/shell/ui/JourneyLongTermNav";

export default function ExploreLayout() {
  return (
    <ExploreAccessGate>
      <View style={{ flex: 1 }}>
        <Stack
          screenLayout={({ children }) => <ExploreAccessGate>{children}</ExploreAccessGate>}
          screenOptions={{ headerShown: false, gestureEnabled: false }}
        />
        <JourneyLongTermNav />
      </View>
    </ExploreAccessGate>
  );
}

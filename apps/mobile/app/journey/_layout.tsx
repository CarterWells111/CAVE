import { Stack } from "expo-router";
import { View } from "react-native";

import { JourneyLongTermNav } from "../../src/features/shell/ui/JourneyLongTermNav";

export default function JourneyLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <JourneyLongTermNav />
    </View>
  );
}

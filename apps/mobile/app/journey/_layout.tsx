import { Stack } from "expo-router";
import { View } from "react-native";

import { useAdultDeclaration } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { JourneyLongTermNav } from "../../src/features/shell/ui/JourneyLongTermNav";

export default function JourneyLayout() {
  const { status } = useAdultDeclaration();

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="adult-gate" />
        <Stack.Protected guard={status === "authorized"}>
          <Stack.Screen name="preface" />
          <Stack.Screen name="body-knowledge" />
          <Stack.Screen name="overnight" />
          <Stack.Screen name="behavior-map" />
          <Stack.Screen name="reflection" />
          <Stack.Screen name="preset-practice" />
          <Stack.Screen name="final-preparation" />
          <Stack.Screen name="behavior-attitudes" />
          <Stack.Screen name="communication-card" />
          <Stack.Screen name="checklist" />
        </Stack.Protected>
      </Stack>
      <JourneyLongTermNav />
    </View>
  );
}

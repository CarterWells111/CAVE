import { Redirect, Stack, usePathname } from "expo-router";
import { View } from "react-native";

import { useAdultDeclaration } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { JourneyLongTermNav } from "../../src/features/shell/ui/JourneyLongTermNav";

const publicJourneyPaths = new Set(["/journey/welcome", "/journey/adult-gate"]);

export default function JourneyLayout() {
  const { status } = useAdultDeclaration();
  const pathname = usePathname();

  if (status === "public" && !publicJourneyPaths.has(pathname)) {
    return <Redirect href="/journey/welcome" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <JourneyLongTermNav />
    </View>
  );
}

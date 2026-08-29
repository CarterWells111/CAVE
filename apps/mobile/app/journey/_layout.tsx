import { Redirect, Stack, usePathname } from "expo-router";
import { View } from "react-native";

import { useAdultDeclaration } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import {
  JourneyNavigationLockProvider,
  useJourneyNavigationLock,
} from "../../src/features/journey/ui/journey-navigation-lock";
import { JourneyLongTermNav } from "../../src/features/shell/ui/JourneyLongTermNav";

const publicJourneyPaths = new Set(["/journey/welcome", "/journey/adult-gate"]);

function JourneyNavigator() {
  const { status } = useAdultDeclaration();
  const { locked } = useJourneyNavigationLock();
  const pathname = usePathname();

  if (status === "public" && !publicJourneyPaths.has(pathname)) {
    return <Redirect href="/journey/welcome" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ gestureEnabled: !locked, headerShown: false }} />
      <JourneyLongTermNav disabled={locked} />
    </View>
  );
}

export default function JourneyLayout() {
  return (
    <JourneyNavigationLockProvider>
      <JourneyNavigator />
    </JourneyNavigationLockProvider>
  );
}

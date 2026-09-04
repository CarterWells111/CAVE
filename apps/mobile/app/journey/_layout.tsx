import { Redirect, Stack, usePathname } from "expo-router";
import type { PropsWithChildren } from "react";
import { View } from "react-native";

import { useAdultDeclaration } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { shouldEnableJourneyNativeBackGesture } from "../../src/features/journey/application/journey-navigation";
import {
  JourneyNavigationLockProvider,
  useJourneyNavigationLock,
} from "../../src/features/journey/ui/journey-navigation-lock";
import { JourneyLongTermNav } from "../../src/features/shell/ui/JourneyLongTermNav";

const publicJourneyPaths = new Set(["/journey/welcome", "/journey/adult-gate"]);

function JourneyScreenLayout({ children, route }: PropsWithChildren<{ route: { name: string } }>) {
  const { status } = useAdultDeclaration();
  // Inactive stack screens can remain mounted after navigation. Guard each one,
  // including screens underneath the public destination after revocation.
  if (status === "public" && !publicJourneyPaths.has(`/journey/${route.name}`)) {
    return <Redirect href="/journey/welcome" />;
  }
  return children;
}

function JourneyNavigator() {
  const { status } = useAdultDeclaration();
  const { locked } = useJourneyNavigationLock();
  const pathname = usePathname();

  if (status === "public" && !publicJourneyPaths.has(pathname)) {
    return <Redirect href="/journey/welcome" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenLayout={(props) => <JourneyScreenLayout {...props} />}
        screenOptions={{
          gestureEnabled: shouldEnableJourneyNativeBackGesture(pathname, locked),
          headerShown: false,
        }}
      />
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

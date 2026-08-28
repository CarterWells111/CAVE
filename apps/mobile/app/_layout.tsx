import { Stack } from "expo-router";

import { MotionPreferencesProvider } from "../src/core/design/motion-preferences";
import { createExpoJourneyRuntime } from "../src/features/journey/runtime/default-journey-runtime";
import { JourneyRuntimeProvider } from "../src/features/journey/runtime/JourneyRuntimeProvider";

export default function RootLayout() {
  return (
    <MotionPreferencesProvider>
      <JourneyRuntimeProvider createRuntime={createExpoJourneyRuntime}>
        <Stack screenOptions={{ headerShown: false }} />
      </JourneyRuntimeProvider>
    </MotionPreferencesProvider>
  );
}

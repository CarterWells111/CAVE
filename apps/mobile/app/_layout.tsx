import { Stack } from "expo-router";

import { createExpoJourneyRuntime } from "../src/features/journey/runtime/default-journey-runtime";
import { JourneyRuntimeProvider } from "../src/features/journey/runtime/JourneyRuntimeProvider";

export default function RootLayout() {
  return (
    <JourneyRuntimeProvider createRuntime={createExpoJourneyRuntime}>
      <Stack screenOptions={{ headerShown: false }} />
    </JourneyRuntimeProvider>
  );
}

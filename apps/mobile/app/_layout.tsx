import { Stack } from "expo-router";
import { type PropsWithChildren, useMemo } from "react";

import { MotionPreferencesProvider } from "../src/core/design/motion-preferences";
import { AccountProfileProvider } from "../src/features/account/runtime/AccountProfileProvider";
import { AuthProvider } from "../src/features/auth/runtime/AuthProvider";
import { createExpoAuthDependencies } from "../src/features/auth/runtime/expo-auth-dependencies";
import { createExpoJourneyRuntime } from "../src/features/journey/runtime/default-journey-runtime";
import { JourneyRuntimeProvider, useAdultDeclaration } from "../src/features/journey/runtime/JourneyRuntimeProvider";
import { JournalAccessProvider } from "../src/features/journal/runtime/JournalAccessProvider";

function AuthBoundary({ children }: PropsWithChildren) {
  const { status } = useAdultDeclaration();
  const dependencies = useMemo(createExpoAuthDependencies, []);
  return (
    <AuthProvider adultStatus={status} dependencies={dependencies}>
      <AccountProfileProvider>
        <JournalAccessProvider>{children}</JournalAccessProvider>
      </AccountProfileProvider>
    </AuthProvider>
  );
}

export default function RootLayout() {
  return (
    <MotionPreferencesProvider>
      <JourneyRuntimeProvider createRuntime={createExpoJourneyRuntime}>
        <AuthBoundary>
          <Stack screenOptions={{ headerShown: false }} />
        </AuthBoundary>
      </JourneyRuntimeProvider>
    </MotionPreferencesProvider>
  );
}

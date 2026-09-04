import { Stack } from "expo-router";
import Constants from "expo-constants";
import { type PropsWithChildren, useMemo } from "react";

import { MotionPreferencesProvider } from "../src/core/design/motion-preferences";
import { AccountProfileProvider } from "../src/features/account/runtime/AccountProfileProvider";
import { AuthProvider } from "../src/features/auth/runtime/AuthProvider";
import { createExpoAuthDependencies } from "../src/features/auth/runtime/expo-auth-dependencies";
import { createExpoJourneyRuntime } from "../src/features/journey/runtime/default-journey-runtime";
import { JourneyRuntimeProvider, useAdultDeclaration } from "../src/features/journey/runtime/JourneyRuntimeProvider";
import { JournalAccessProvider } from "../src/features/journal/runtime/JournalAccessProvider";

function AcceptanceBoundary({ children }: PropsWithChildren) {
  if (__DEV__ && Constants.expoConfig?.extra?.environment === "acceptance" && Constants.expoConfig?.extra?.acceptanceTools === true) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro removes this dev-only branch from release bundles.
    const { AcceptanceEntry } = require("../src/features/acceptance/AcceptanceEntry") as typeof import("../src/features/acceptance/AcceptanceEntry");
    return <AcceptanceEntry>{children}</AcceptanceEntry>;
  }
  return children;
}

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
      <AcceptanceBoundary>
      <JourneyRuntimeProvider createRuntime={createExpoJourneyRuntime}>
        <AuthBoundary>
          <Stack screenOptions={{ headerShown: false }} />
        </AuthBoundary>
      </JourneyRuntimeProvider>
      </AcceptanceBoundary>
    </MotionPreferencesProvider>
  );
}

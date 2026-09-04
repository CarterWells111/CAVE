import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

import { Screen } from "../../src/core/ui/Screen";
import { useOptionalAuth } from "../../src/features/auth/runtime/AuthProvider";
import { useOptionalAccountPreferences } from "../../src/features/account/runtime/AccountPreferencesProvider";
import {
  useAdultDeclaration,
  useOptionalJourneyRuntime
} from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { AdultGatePage } from "../../src/features/journey/ui/pages/adult-gate-page";

export default function AdultGateRoute() {
  const router = useRouter();
  const auth = useOptionalAuth();
  const preferences = useOptionalAccountPreferences();
  const adultDeclaration = useAdultDeclaration();
  const runtime = useOptionalJourneyRuntime();
  const authorizationReady = adultDeclaration.status === "authorized"
    && runtime?.snapshot?.ageConfirmed === true;
  const activeRef = useRef(false);
  const decisionRef = useRef<object | null>(null);
  const navigatedRef = useRef(false);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      decisionRef.current = null;
    };
  }, []);

  const openPreface = useCallback(() => {
    if (!activeRef.current || navigatedRef.current) return;
    navigatedRef.current = true;
    decisionRef.current = null;
    router.replace("/journey/preface");
  }, [router]);

  useEffect(() => {
    if (authorizationReady) openPreface();
  }, [authorizationReady, openPreface]);

  useEffect(() => {
    if (preferences?.ready && preferences.preferences.ageConfirmed && runtime !== null && runtime.snapshot === null) {
      void runtime.runAndRefresh(() => adultDeclaration.confirmAdult()).catch(() => undefined);
    }
  }, [adultDeclaration, preferences, runtime]);

  const confirmAdult = () => {
    if (!activeRef.current || decisionRef.current !== null || navigatedRef.current) return;
    const decision = {};
    decisionRef.current = decision;
    const confirmation = runtime === null
      ? adultDeclaration.confirmAdult()
      : runtime.runAndRefresh(() => adultDeclaration.confirmAdult());
    return confirmation
      .catch((error: unknown) => {
        if (activeRef.current && decisionRef.current === decision) decisionRef.current = null;
        throw error;
      });
  };

  const exitUnderage = async () => {
    if (!activeRef.current || decisionRef.current !== null || navigatedRef.current) return;
    decisionRef.current = {};
    try { await preferences?.change({ ageConfirmed: false }); }
    catch (error) { decisionRef.current = null; throw error; }
    navigatedRef.current = true;
    router.replace("/underage-exit");
  };

  if (authorizationReady) return null;
  return (
    <Screen>
      <AdultGatePage
        onSignIn={auth?.status === "signedOut" ? () => router.push({ pathname: "/auth/email", params: { returnTo: "/journey/adult-gate" } }) : undefined}
        onConfirmAdult={confirmAdult}
        onUnderage={exitUnderage}
      />
    </Screen>
  );
}

import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

import { Screen } from "../../src/core/ui/Screen";
import {
  useAdultDeclaration,
  useOptionalJourneyRuntime
} from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { AdultGatePage } from "../../src/features/journey/ui/pages/adult-gate-page";

export default function AdultGateRoute() {
  const router = useRouter();
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

  const exitUnderage = () => {
    if (!activeRef.current || decisionRef.current !== null || navigatedRef.current) return;
    decisionRef.current = {};
    navigatedRef.current = true;
    router.replace("/underage-exit");
  };

  if (authorizationReady) return null;
  return (
    <Screen>
      <AdultGatePage
        onConfirmAdult={confirmAdult}
        onUnderage={exitUnderage}
      />
    </Screen>
  );
}

import { useCallback, useEffect, useState } from "react";

import type { JourneyRuntimeContextValue } from "../../journey/runtime/JourneyRuntimeProvider";
import { hasJourneyOnboarding } from "../application/journey-entry";

type AccessStatus = "onboarding" | "loading" | "error" | "ready";
type Runtime = JourneyRuntimeContextValue | null;
type CompletionRead = {
  source: Runtime;
  attempt: number;
  status: AccessStatus;
};

// Onboarding, not completion of the scenario, unlocks the map. Completion is
// only the legacy fallback for users whose finished draft has been cleared.
export function useJourneyMapAccess(runtime: Runtime) {
  const [attempt, setAttempt] = useState(0);
  const [read, setRead] = useState<CompletionRead | null>(null);
  const onboarded = hasJourneyOnboarding(runtime?.snapshot);
  const publicAccess = runtime === null || runtime.snapshot?.ageConfirmed === false;
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (publicAccess || onboarded || runtime === null) return;
    let active = true;
    void runtime.shellState.load().then(
      (completion) => {
        if (active) setRead({ source: runtime, attempt, status: completion === null ? "onboarding" : "ready" });
      },
      () => { if (active) setRead({ source: runtime, attempt, status: "error" }); },
    );
    return () => { active = false; };
  }, [attempt, onboarded, publicAccess, runtime]);

  const status: AccessStatus = publicAccess ? "onboarding"
    : onboarded ? "ready"
      : read?.source === runtime && read.attempt === attempt ? read.status : "loading";
  return { status, retry };
}

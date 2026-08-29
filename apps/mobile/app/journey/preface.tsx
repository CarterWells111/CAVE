import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";

import { Screen } from "../../src/core/ui/Screen";
import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { PrefacePage } from "../../src/features/journey/ui/pages/preface-page";
import { PrefaceWelcomeSheet } from "../../src/features/journey/ui/pages/preface-welcome-sheet";

export default function PrefaceRoute() {
  const router = useRouter();
  const runtime = useJourneyRuntime();
  const eligible = runtime.snapshot?.ageConfirmed === true;
  const preference = runtime.snapshot?.addressPreference ?? null;
  const prefaceRead = runtime.snapshot?.prefaceRead === true;
  const completed = eligible && preference !== null && prefaceRead;
  const navigationDestination = !eligible
    ? "/journey/welcome"
    : completed ? "/journey/body-knowledge" : null;
  const replacedDestination = useRef<string | null>(null);

  useEffect(() => {
    if (navigationDestination === null) {
      replacedDestination.current = null;
      return;
    }
    if (replacedDestination.current === navigationDestination) return;
    replacedDestination.current = navigationDestination;
    router.replace(navigationDestination);
  }, [navigationDestination, router]);

  if (!eligible || completed) return null;
  return (
    <Screen>
      {preference === null ? (
        <PrefacePage
          onContinue={(selectedPreference) => runtime.runAndRefresh(async () => {
            if (prefaceRead) {
              await runtime.service.dispatch({ type: "set-preface-read", read: false });
            }
            await runtime.service.dispatch({
              type: "set-address-preference",
              preference: selectedPreference,
            });
          })}
        />
      ) : (
        <PrefaceWelcomeSheet
          onConfirm={() => runtime.runAndRefresh(() => (
            runtime.service.dispatch({ type: "set-preface-read", read: true })
          ))}
          preference={preference}
          visible
        />
      )}
    </Screen>
  );
}

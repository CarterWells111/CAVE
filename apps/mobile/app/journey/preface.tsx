import { useRouter } from "expo-router";
import { useEffect } from "react";

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

  useEffect(() => {
    if (!eligible) {
      router.replace("/journey/welcome");
      return;
    }
    if (completed) router.replace("/journey/body-knowledge");
  }, [completed, eligible, router]);

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

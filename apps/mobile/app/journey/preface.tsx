import { useRouter } from "expo-router";
import { useEffect } from "react";

import { Screen } from "../../src/core/ui/Screen";
import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { PrefacePage } from "../../src/features/journey/ui/pages/preface-page";

export default function PrefaceRoute() {
  const router = useRouter();
  const runtime = useJourneyRuntime();
  const eligible = runtime.snapshot?.ageConfirmed === true;

  useEffect(() => {
    if (!eligible) router.replace("/journey/welcome");
  }, [eligible, router]);

  if (!eligible) return null;
  return (
    <Screen>
      <PrefacePage
        onContinue={(preference) => runtime.runAndRefresh(() => {
          return runtime.service.dispatch({ type: "set-address-preference", preference })
            .then(() => runtime.service.dispatch({ type: "set-preface-read", read: true }));
        }).then(() => router.replace("/journey/body-knowledge"))}
      />
    </Screen>
  );
}

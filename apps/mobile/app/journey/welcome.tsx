import { useRouter } from "expo-router";

import { Screen } from "../../src/core/ui/Screen";
import { getResumePath } from "../../src/features/journey/application/journey-navigation";
import { useOptionalJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { WelcomePage } from "../../src/features/journey/ui/pages/WelcomePage";

export default function WelcomeRoute() {
  const router = useRouter();
  const runtime = useOptionalJourneyRuntime();
  const snapshot = runtime?.snapshot ?? null;
  const resumeAvailable = snapshot?.ageConfirmed === true;
  const resume = () => {
    if (snapshot === null || snapshot.addressPreference === null || !snapshot.prefaceRead) {
      router.replace("/journey/preface");
      return;
    }
    router.replace(getResumePath(snapshot));
  };
  return (
    <Screen>
      <WelcomePage
        onOpenSettings={runtime ? () => router.push("/settings") : undefined}
        onResume={resume}
        onStart={() => router.push("/journey/adult-gate")}
        resumeAvailable={resumeAvailable}
      />
    </Screen>
  );
}

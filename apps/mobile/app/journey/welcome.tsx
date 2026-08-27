import { useRouter } from "expo-router";

import { WelcomePage } from "../../src/features/journey/ui/pages/JourneyPages";
import { JourneyScreenShell } from "../../src/features/journey/ui/JourneyScreenShell";

export default function WelcomeRoute() {
  const router = useRouter();
  return (
    <JourneyScreenShell pageId="welcome">
      <WelcomePage
        onAdult={() => router.push("/journey/overnight")}
        onOpenPreface={() => router.push("/journey/preface")}
        onUnderage={() => router.push("/journey/underage-exit")}
        resumeAvailable={false}
      />
    </JourneyScreenShell>
  );
}

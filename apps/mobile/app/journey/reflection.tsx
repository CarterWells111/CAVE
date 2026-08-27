import { ReflectionPage } from "../../src/features/journey/ui/pages/JourneyPages";
import { JourneyScreenShell } from "../../src/features/journey/ui/JourneyScreenShell";

export default function ReflectionRoute() {
  return (
    <JourneyScreenShell pageId="reflection">
      <ReflectionPage onComplete={() => undefined} />
    </JourneyScreenShell>
  );
}

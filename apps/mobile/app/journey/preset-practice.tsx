import { loadJourneyContentCatalog } from "../../src/features/journey/infrastructure/journey-content-catalog";
import { PresetPracticePage } from "../../src/features/journey/ui/pages/JourneyPages";
import { JourneyScreenShell } from "../../src/features/journey/ui/JourneyScreenShell";

export default function PresetPracticeRoute() {
  const phrase = loadJourneyContentCatalog().practice.phrases[0]?.text ?? "先暂停一下。";
  return (
    <JourneyScreenShell pageId="preset-practice">
      <PresetPracticePage onComplete={() => undefined} phrase={phrase} />
    </JourneyScreenShell>
  );
}

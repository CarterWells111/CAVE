import { CommunicationCardPage } from "../../src/features/journey/ui/pages/JourneyPages";
import { JourneyScreenShell } from "../../src/features/journey/ui/JourneyScreenShell";

export default function CommunicationCardRoute() {
  return (
    <JourneyScreenShell pageId="communication-card">
      <CommunicationCardPage
        fields={[
          { id: "intentions", text: "draft-card.intentions", needsReview: false },
          { id: "boundaries", text: "draft-card.boundaries", needsReview: false },
          { id: "pace", text: "draft-card.pace", needsReview: false },
          { id: "comfort", text: "draft-card.comfort", needsReview: false },
          { id: "practical", text: "draft-card.practical", needsReview: false },
          { id: "aftercare", text: "draft-card.aftercare", needsReview: false }
        ]}
        onCopy={() => undefined}
        onEdit={() => undefined}
        onSave={() => undefined}
        pointTotal={0}
      />
    </JourneyScreenShell>
  );
}

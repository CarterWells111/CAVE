import { useState } from "react";

import { COMMUNICATION_CARD_SECTION_IDS } from "../../src/features/journey/domain/derive-communication-card";
import { getPointSummary } from "../../src/features/journey/application/points-ledger";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { CommunicationCardPage } from "../../src/features/journey/ui/pages/JourneyPages";
import type { ClipboardActionState } from "../../src/features/journey/ui/pages/JourneyPages";

export default function CommunicationCardRoute() {
  const [copyState, setCopyState] = useState<ClipboardActionState>({ status: "idle" });
  return (
    <JourneyRouteScreen pageId="communication-card">
      {({ controller, runAndRefresh, snapshot }) => (
        <CommunicationCardPage
          copyState={copyState}
          fields={COMMUNICATION_CARD_SECTION_IDS.flatMap((id) => {
            const field = snapshot?.communicationCard[id];
            return field === undefined ? [] : [{
              id,
              text: field.userText ?? field.generatedText,
              needsReview: field.needsReview
            }];
          })}
          onCopy={() => {
            setCopyState({ status: "pending" });
            void controller.copyCommunicationCard().then(setCopyState);
          }}
          onEdit={(sectionId, userText) => {
            void runAndRefresh(() => controller.editCommunicationCard(sectionId, userText));
          }}
          onSave={() => { void controller.saveCommunicationCard(); }}
          pointTotal={getPointSummary(snapshot?.pointEventKeys ?? []).total}
        />
      )}
    </JourneyRouteScreen>
  );
}

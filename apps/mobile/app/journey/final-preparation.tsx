import { useState } from "react";

import { getPointSummary } from "../../src/features/journey/application/points-ledger";
import { COMMUNICATION_CARD_SECTION_IDS } from "../../src/features/journey/domain/derive-communication-card";
import type { ChecklistItem, JourneyDraft } from "../../src/features/journey/domain/types";
import { loadJourneyContentCatalog } from "../../src/features/journey/infrastructure/journey-content-catalog";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import {
  ChecklistPage,
  CommunicationCardPage,
  type ClipboardActionState
} from "../../src/features/journey/ui/pages/JourneyPages";

const CATEGORY_LABELS: Record<ChecklistItem["category"], string> = {
  aftercare: "事后照顾",
  attitude: "行为态度",
  comfort: "安心条件",
  communication: "沟通准备",
  expression: "表达暂停、边界与需要",
  health: "健康准备",
  logistics: "过夜安排与个人空间"
};

function checklistLabel(item: ChecklistItem, snapshot: JourneyDraft | null) {
  const catalog = loadJourneyContentCatalog();
  const sourceId = item.id.split(":").slice(2).join(":");
  const sourceLabel = catalog.options.find(({ id }) => id === sourceId)?.label
    ?? snapshot?.customBehaviors.find(({ id }) => id === sourceId)?.label;
  if (sourceLabel === undefined) return CATEGORY_LABELS[item.category];
  if (item.category === "attitude") return `关于「${sourceLabel}」的态度`;
  return `${CATEGORY_LABELS[item.category]}：${sourceLabel}`;
}

export default function FinalPreparationRoute() {
  const [copyState, setCopyState] = useState<ClipboardActionState>({ status: "idle" });
  return (
    <JourneyRouteScreen pageId="final-preparation">
      {({ controller, runAndRefresh, snapshot }) => (
        <>
          <ChecklistPage
            items={(snapshot?.privatePreparation.items ?? []).map((item) => ({
              id: item.id,
              label: checklistLabel(item, snapshot),
              status: item.status,
              userNote: item.userNote ?? ""
            }))}
            onFinish={() => runAndRefresh(() => controller.finishChecklistReview())}
            onUpdate={(itemId, status, userNote) => runAndRefresh(
              () => controller.updateChecklist(itemId, status, userNote)
            )}
          />
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
              return controller.copyCommunicationCard().then(setCopyState);
            }}
            onEdit={(sectionId, userText) => runAndRefresh(
              () => controller.editCommunicationCard(sectionId, userText)
            )}
            onSave={() => controller.saveCommunicationCard()}
            pointTotal={getPointSummary(snapshot?.pointEventKeys ?? []).total}
          />
        </>
      )}
    </JourneyRouteScreen>
  );
}

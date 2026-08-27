import type { JourneyDraft } from "../../src/features/journey/domain/types";
import { loadJourneyContentCatalog } from "../../src/features/journey/infrastructure/journey-content-catalog";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { ChecklistPage } from "../../src/features/journey/ui/pages/JourneyPages";

const CATEGORY_LABELS: Record<JourneyDraft["checklistItems"][number]["category"], string> = {
  aftercare: "事后照顾",
  attitude: "行为态度",
  comfort: "安心条件",
  communication: "沟通准备",
  expression: "表达暂停、边界与需要",
  health: "健康准备",
  logistics: "过夜安排与个人空间"
};

function checklistLabel(item: JourneyDraft["checklistItems"][number], snapshot: JourneyDraft | null) {
  const catalog = loadJourneyContentCatalog();
  const sourceId = item.id.split(":").slice(2).join(":");
  const sourceLabel = catalog.options.find(({ id }) => id === sourceId)?.label
    ?? snapshot?.customBehaviors.find(({ id }) => id === sourceId)?.label;
  if (sourceLabel === undefined) return CATEGORY_LABELS[item.category];
  if (item.category === "attitude") return `关于「${sourceLabel}」的态度`;
  return `${CATEGORY_LABELS[item.category]}：${sourceLabel}`;
}

export default function ChecklistRoute() {
  return (
    <JourneyRouteScreen pageId="checklist">
      {({ controller, goTo, runAndRefresh, snapshot }) => (
        <ChecklistPage
          items={(snapshot?.checklistItems ?? []).map((item) => ({
            id: item.id,
            label: checklistLabel(item, snapshot),
            status: item.status,
            userNote: item.userNote ?? ""
          }))}
          onFinish={async () => {
            await runAndRefresh(() => controller.finishChecklistReview());
            await goTo("communication-card");
          }}
          onUpdate={(itemId, status, userNote) => runAndRefresh(
            () => controller.updateChecklist(itemId, status, userNote)
          )}
        />
      )}
    </JourneyRouteScreen>
  );
}

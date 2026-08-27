import type { ChecklistItem, JourneyDraft } from "./types";

const HEALTH_RELATED_BEHAVIOR_IDS = new Set([
  "draft-penetrative-sex",
  "draft-oral-sex"
]);

type ChecklistSeed = Pick<ChecklistItem, "id" | "category" | "sourceIds">;

function seedItems(draft: JourneyDraft): ChecklistSeed[] {
  const items: ChecklistSeed[] = [];

  if (draft.expectationIds.length > 0 || draft.concernIds.length > 0 || draft.overnightCustomNote.length > 0) {
    items.push({ id: "checklist:logistics", category: "logistics", sourceIds: [] });
  }
  for (const behaviorId of Object.keys(draft.behaviorAttitudes)) {
    items.push({ id: `checklist:attitude:${behaviorId}`, category: "attitude", sourceIds: [] });
  }
  if (draft.expressionSupportNeeded === true || draft.practice.completed) {
    items.push({ id: "checklist:expression", category: "expression", sourceIds: [] });
  }
  for (const comfortId of draft.comfortNeedIds) {
    items.push({ id: `checklist:comfort:${comfortId}`, category: "comfort", sourceIds: [] });
  }
  for (const behaviorId of Object.keys(draft.behaviorAttitudes)) {
    if (HEALTH_RELATED_BEHAVIOR_IDS.has(behaviorId)) {
      items.push({
        id: `checklist:health:${behaviorId}`,
        category: "health",
        sourceIds: ["draft-source-sexual-health"]
      });
    }
  }
  return items;
}

export function buildChecklist(draft: JourneyDraft): ChecklistItem[] {
  const existing = new Map(draft.checklistItems.map((item) => [item.id, item]));
  return seedItems(draft).map((seed) => {
    const previous = existing.get(seed.id);
    return previous === undefined
      ? { ...seed, status: "prepare-more" }
      : { ...seed, status: previous.status, ...(previous.userNote === undefined ? {} : { userNote: previous.userNote }) };
  });
}

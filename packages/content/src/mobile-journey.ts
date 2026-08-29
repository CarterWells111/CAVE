import journeyKnowledge from "../data/journey-knowledge.json";
import journeyOptions from "../data/journey-options.json";
import journeyPractice from "../data/journey-practice.json";
import journeyUiCopy from "../data/journey-ui-copy.json";
import type { ContentCatalog } from "./catalog";
import { MobileJourneyContentCatalogSchema } from "./journey-schema";

export type MobileJourneyContentCatalog = Omit<ContentCatalog["journey"], "sources">;

const checkedInMobileJourneyCatalog = {
  options: journeyOptions,
  knowledge: journeyKnowledge,
  practice: journeyPractice,
  uiCopy: journeyUiCopy
};

export function loadMobileJourneyContentCatalog(): MobileJourneyContentCatalog {
  return MobileJourneyContentCatalogSchema.parse(structuredClone(checkedInMobileJourneyCatalog));
}

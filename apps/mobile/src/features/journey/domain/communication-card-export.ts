import { COMMUNICATION_CARD_CONSENT_FOOTER } from "./derive-communication-card";
import type { CommunicationSectionId } from "./types";

export type CommunicationCardExportModel = Readonly<{
  title: "靠近之前，我想告诉你";
  sections: readonly Readonly<{ id: CommunicationSectionId; title: string; text: string }>[];
  consentFooter: typeof COMMUNICATION_CARD_CONSENT_FOOTER;
}>;

export function createCommunicationCardExportModel(
  sections: readonly Readonly<{ id: CommunicationSectionId; title: string; text: string }>[],
): CommunicationCardExportModel {
  return Object.freeze({
    title: "靠近之前，我想告诉你" as const,
    sections: Object.freeze(sections.map((section) => Object.freeze({ ...section }))),
    consentFooter: COMMUNICATION_CARD_CONSENT_FOOTER,
  });
}

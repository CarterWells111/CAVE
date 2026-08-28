import {
  type JourneyDraftV1,
  type JourneyDraftV2
} from "./migrate-journey-draft";
import {
  COMMUNICATION_SECTION_IDS,
  type JourneyDraft,
  type JourneyDraftV3
} from "./types";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isBehaviorAttitudes(value: unknown): value is JourneyDraft["behaviorAttitudes"] {
  return isRecord(value) && Object.values(value).every((attitude) => isOneOf(attitude, [
    "looking-forward", "familiar-enjoyed", "decide-in-moment", "unsure", "not-this-time", "skip"
  ]));
}

function isCustomBehaviors(value: unknown): value is JourneyDraft["customBehaviors"] {
  return Array.isArray(value) && value.every((entry) => isRecord(entry)
    && typeof entry.id === "string"
    && typeof entry.label === "string");
}

function isPractice(value: unknown): value is JourneyDraft["practice"] {
  return isRecord(value)
    && typeof value.completed === "boolean"
    && typeof value.mirrorRehearsed === "boolean"
    && isOptionalString(value.behaviorId)
    && isOptionalString(value.intent)
    && isOptionalString(value.selectedPhraseId)
    && isOptionalString(value.editedPhrase)
    && isOptionalString(value.partnerResponseBranch)
    && isOptionalString(value.responseId)
    && isOptionalString(value.catalogVersion)
    && isOptionalString(value.reflectionNote)
    && isOptionalString(value.phrase)
    && isOptionalString(value.aftercareId)
    && isOptionalString(value.optionalBranch)
    && isOptionalString(value.optionalResponse)
    && (value.safetyTerminal === undefined || typeof value.safetyTerminal === "boolean");
}

function isChecklistItems(value: unknown): value is JourneyDraft["privatePreparation"]["items"] {
  return Array.isArray(value) && value.every((entry) => isRecord(entry)
    && typeof entry.id === "string"
    && isOneOf(entry.category, [
      "attitude", "expression", "comfort", "communication", "logistics", "health", "aftercare"
    ])
    && isStringArray(entry.sourceIds)
    && isOneOf(entry.status, ["considered", "prepare-more", "not-relevant"])
    && isOptionalString(entry.userNote));
}

export function isCommunicationCard(value: unknown): value is JourneyDraft["communicationCard"] {
  return isRecord(value)
    && Object.keys(value).length === COMMUNICATION_SECTION_IDS.length
    && COMMUNICATION_SECTION_IDS.every((sectionId) => isRecord(value[sectionId])
    && typeof value[sectionId].generatedText === "string"
    && isOptionalString(value[sectionId].userText)
    && typeof value[sectionId].sourceRevision === "number"
    && Number.isInteger(value[sectionId].sourceRevision)
    && value[sectionId].sourceRevision >= 0
    && typeof value[sectionId].needsReview === "boolean"
    && isOneOf(value[sectionId].visibility, ["pending", "included", "private", "deleted"]));
}

function isOvernightState(value: unknown): value is JourneyDraft["overnight"] {
  return isRecord(value)
    && isOneOf(value.stage, ["expectations", "concerns"])
    && isOneOf(value.resumeStage, ["expectations", "concerns"]);
}

function isReflection(value: unknown): value is JourneyDraft["reflection"] {
  return isRecord(value)
    && (value.pressureWithoutDisappointment === null || typeof value.pressureWithoutDisappointment === "string")
    && (value.refusalSafety === null || typeof value.refusalSafety === "string")
    && (value.expressionDifficulty === null || typeof value.expressionDifficulty === "string")
    && (value.comfortClarity === null || typeof value.comfortClarity === "string")
    && typeof value.comfortNote === "string";
}

function isJournal(value: unknown): value is JourneyDraft["journal"] {
  return isRecord(value)
    && isOptionalString(value.promptId)
    && typeof value.text === "string"
    && isOneOf(value.saveChoice, ["device", "not-saved"])
    && isOptionalString(value.savedAt);
}

function isPrivatePreparation(value: unknown): value is JourneyDraft["privatePreparation"] {
  return isRecord(value)
    && isChecklistItems(value.items)
    && isStringArray(value.excludedGroupIds)
    && isStringArray(value.aftercareIds)
    && isOptionalString(value.customNeed);
}

export function isLegacyCommunicationCard(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Object.values(value).every((field) => isRecord(field)
    && typeof field.generatedText === "string"
    && isOptionalString(field.userText)
    && typeof field.sourceRevision === "number"
    && Number.isInteger(field.sourceRevision)
    && field.sourceRevision >= 0
    && typeof field.needsReview === "boolean");
}

function isLegacyPractice(value: unknown): value is JourneyDraftV1["practice"] {
  return isRecord(value)
    && typeof value.completed === "boolean"
    && isOptionalString(value.behaviorId)
    && isOptionalString(value.intent)
    && isOptionalString(value.selectedPhraseId)
    && isOptionalString(value.editedPhrase)
    && isOptionalString(value.partnerResponseBranch)
    && isOptionalString(value.responseId)
    && isOptionalString(value.catalogVersion)
    && isOptionalString(value.reflectionNote);
}

export function isJourneyDraftV1(value: unknown): value is JourneyDraftV1 {
  if (!isRecord(value)) return false;
  return value.schemaVersion === 1
    && typeof value.id === "string"
    && isOneOf(value.currentPage, [
      "welcome", "overnight", "body-knowledge", "behavior-attitudes", "reflection",
      "preset-practice", "checklist", "communication-card"
    ])
    && typeof value.ageConfirmed === "boolean"
    && typeof value.prefaceRead === "boolean"
    && isStringArray(value.expectationIds)
    && isStringArray(value.concernIds)
    && typeof value.overnightCustomNote === "string"
    && isStringArray(value.readKnowledgeCardIds)
    && typeof value.medicalDiagramOpened === "boolean"
    && isBehaviorAttitudes(value.behaviorAttitudes)
    && isCustomBehaviors(value.customBehaviors)
    && isStringArray(value.motivationIds)
    && isStringArray(value.comfortNeedIds)
    && (typeof value.expressionSupportNeeded === "boolean" || value.expressionSupportNeeded === null)
    && isOneOf(value.journalSaveChoice, ["device", "not-saved"])
    && value.cloudSaveAvailability === "coming-soon"
    && isLegacyPractice(value.practice)
    && isChecklistItems(value.checklistItems)
    && isLegacyCommunicationCard(value.communicationCard)
    && isStringArray(value.pointEventKeys)
    && typeof value.sourceRevision === "number"
    && Number.isInteger(value.sourceRevision)
    && value.sourceRevision >= 0
    && typeof value.createdAt === "string"
    && typeof value.updatedAt === "string";
}

function isSharedV2OrV3Fields(value: Record<string, unknown>): boolean {
  return typeof value.id === "string"
    && typeof value.ageConfirmed === "boolean"
    && (value.addressPreference === null || value.addressPreference === "你" || value.addressPreference === "妳")
    && typeof value.prefaceRead === "boolean"
    && (typeof value.explicitContentConsent === "boolean" || value.explicitContentConsent === null)
    && isOvernightState(value.overnight)
    && isStringArray(value.expectationIds)
    && isStringArray(value.concernIds)
    && typeof value.overnightCustomNote === "string"
    && isStringArray(value.readKnowledgeCardIds)
    && typeof value.medicalDiagramOpened === "boolean"
    && isBehaviorAttitudes(value.behaviorAttitudes)
    && isCustomBehaviors(value.customBehaviors)
    && isStringArray(value.motivationIds)
    && isStringArray(value.comfortNeedIds)
    && (typeof value.expressionSupportNeeded === "boolean" || value.expressionSupportNeeded === null)
    && isReflection(value.reflection)
    && isOneOf(value.journalSaveChoice, ["device", "not-saved"])
    && isJournal(value.journal)
    && isPractice(value.practice)
    && isPrivatePreparation(value.privatePreparation)
    && isCommunicationCard(value.communicationCard)
    && isStringArray(value.pointEventKeys)
    && typeof value.sourceRevision === "number"
    && Number.isInteger(value.sourceRevision)
    && value.sourceRevision >= 0
    && typeof value.createdAt === "string"
    && typeof value.updatedAt === "string";
}

export function isJourneyDraftV2(value: unknown): value is JourneyDraftV2 {
  if (!isRecord(value) || value.schemaVersion !== 2 || !isSharedV2OrV3Fields(value)) return false;
  const isOriginMainV2 = value.cloudSaveAvailability === "coming-soon"
    && isOneOf(value.currentPage, [
      "welcome", "overnight", "body-knowledge", "behavior-map", "reflection",
      "preset-practice", "final-preparation"
    ]);
  const isInterimV2 = value.cloudSaveAvailability === undefined
    && isOneOf(value.currentPage, [
      "body-knowledge", "overnight", "behavior-map", "reflection",
      "preset-practice", "final-preparation"
    ]);
  return isOriginMainV2 || isInterimV2;
}

export function isJourneyDraftV3(value: unknown): value is JourneyDraftV3 {
  return isRecord(value)
    && value.schemaVersion === 3
    && isOneOf(value.currentPage, [
      "body-knowledge", "overnight", "behavior-map", "reflection",
      "preset-practice", "final-preparation"
    ])
    && isSharedV2OrV3Fields(value);
}

export function isJourneyDraftV4(value: unknown): value is JourneyDraft {
  return isRecord(value)
    && value.schemaVersion === 4
    && isOneOf(value.currentPage, [
      "body-knowledge", "overnight", "behavior-map", "reflection",
      "preset-practice", "final-preparation"
    ])
    && isSharedV2OrV3Fields(value);
}

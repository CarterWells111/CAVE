import type {
  Course,
  Lesson,
  QuizQuestion,
  ReviewStatus,
  ScenarioConfig
} from "@cave/contracts";

export type GuideCategory = {
  id: string;
  title: string;
  reviewStatus: ReviewStatus;
  reviewedAt?: string | undefined;
  sourceRefs: string[];
};

/** Runtime validation constrains this number to the inclusive 1–7 range. */
export type JourneyPage = number;
export type JourneyContentType = "MED" | "EDU" | "UX" | "REVIEW";
export type JourneyReviewStatus =
  | "draft"
  | "expert_review_pending"
  | "reviewed"
  | "revision_required";

export type JourneyReviewEvidence = {
  reviewer?: string | undefined;
  reviewerRole?: string | undefined;
  reviewedAt?: string | undefined;
  reviewedVersion?: string | undefined;
  reviewConclusion?: string | undefined;
};

export type JourneyCopyMetadata = JourneyReviewEvidence & {
  id: string;
  page: JourneyPage;
  contentType: JourneyContentType;
  sourceIds: string[];
  reviewStatus: JourneyReviewStatus;
};

export type JourneyOption = JourneyCopyMetadata & {
  group: "expectation" | "concern" | "behavior" | "motivation" | "comfort" | "health";
  order: number;
  label: string;
  exclusive?: boolean | undefined;
};

export type JourneyKnowledgeCard = JourneyCopyMetadata & {
  order: number;
  title: string;
  body: string;
};

export type JourneyPracticePhrase = JourneyCopyMetadata & {
  intent: string;
  order: number;
  text: string;
};

export type JourneyPracticeResponse = JourneyCopyMetadata & {
  branch: string;
  text: string;
  scripted: true;
  safeTerminal: boolean;
};

export type JourneyPartnerResponse = JourneyCopyMetadata & {
  intent: string;
  order: number;
  text: string;
};

export type JourneySafetyBranch = JourneyCopyMetadata & {
  branch: string;
  order: number;
  partnerText: string;
  userTexts: string[];
  guidance: string;
  safeTerminal: boolean;
};

export type JourneySupportResource = JourneyCopyMetadata & {
  order: number;
  number: "110" | "120" | "12338" | "12348";
  label: string;
  usage: string;
  region: "CN";
  autoDial: false;
};

export type JourneyPracticeCatalog = {
  version: string;
  scripted: true;
  phrases: JourneyPracticePhrase[];
  responses: JourneyPracticeResponse[];
  partnerResponses: JourneyPartnerResponse[];
  safetyBranches: JourneySafetyBranch[];
  supportResources: JourneySupportResource[];
};

export type JourneyBehaviorMapPoint = JourneyCopyMetadata & {
  order: number;
  label: string;
  kind: "behavior" | "more" | "custom";
  behaviorIds: string[];
};

export type JourneyAttitude = JourneyCopyMetadata & {
  order: number;
  value: "expecting" | "familiar-enjoyed" | "decide-in-moment" | "unsure" | "not-this-time" | "skip";
  label: string;
  feedback: string;
};

export type JourneyCommunicationSection = JourneyCopyMetadata & {
  order: number;
  title: string;
  defaultVisibility: "private";
  confirmationRequired: true;
};

export type JourneyBodyKnowledgeDefinition = JourneyCopyMetadata & {
  title: string;
  intro: string;
  examples: string[];
  conclusion: string;
};

export type JourneyUiCopyCatalog = {
  version: string;
  bodyKnowledgeDefinition: JourneyBodyKnowledgeDefinition;
  behaviorMapPoints: JourneyBehaviorMapPoint[];
  attitudes: JourneyAttitude[];
  communicationSections: JourneyCommunicationSection[];
};

export type JourneySource = {
  id: string;
  sourceType: "MED" | "EDU" | "SAFE";
  title: string;
  organization: string;
  url: string;
  appliesTo: string;
  publicationOrReviewDate: string;
  accessedAt: string;
  verificationStatus: "source_verified" | "revision_required";
};

export type ContentCatalog = {
  courses: Course[];
  lessons: Lesson[];
  quizzes: QuizQuestion[];
  scenarios: ScenarioConfig[];
  guide: { categories: GuideCategory[] };
  journey: {
    options: JourneyOption[];
    knowledge: JourneyKnowledgeCard[];
    practice: JourneyPracticeCatalog;
    sources: JourneySource[];
    uiCopy: JourneyUiCopyCatalog;
  };
};

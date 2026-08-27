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

export type JourneyReviewStatus = "draft" | "reviewed";

export type JourneyOption = {
  id: string;
  group: "expectation" | "concern" | "behavior" | "motivation" | "comfort" | "health";
  order: number;
  label: string;
  sourceIds: string[];
  reviewStatus: JourneyReviewStatus;
  reviewedAt?: string | undefined;
};

export type JourneyKnowledgeCard = {
  id: string;
  order: number;
  title: string;
  body: string;
  sourceIds: string[];
  reviewStatus: JourneyReviewStatus;
  reviewedAt?: string | undefined;
};

export type JourneyPracticeCatalog = {
  version: string;
  scripted: true;
  phrases: Array<{
    id: string;
    intent: string;
    order: number;
    text: string;
    reviewStatus: JourneyReviewStatus;
    reviewedAt?: string | undefined;
  }>;
  responses: Array<{
    id: string;
    branch: string;
    text: string;
    scripted: true;
    safeTerminal: boolean;
    reviewStatus: JourneyReviewStatus;
    reviewedAt?: string | undefined;
  }>;
};

export type JourneySource = {
  id: string;
  title: string;
  url: string;
  reviewStatus: JourneyReviewStatus;
  reviewedAt?: string | undefined;
};

export type ContentCatalog = {
  courses: Course[];
  lessons: Lesson[];
  quizzes: QuizQuestion[];
  scenarios: ScenarioConfig[];
  guide: {
    categories: GuideCategory[];
  };
  journey: {
    options: JourneyOption[];
    knowledge: JourneyKnowledgeCard[];
    practice: JourneyPracticeCatalog;
    sources: JourneySource[];
  };
};

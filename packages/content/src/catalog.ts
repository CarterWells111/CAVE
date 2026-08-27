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

export type ContentCatalog = {
  courses: Course[];
  lessons: Lesson[];
  quizzes: QuizQuestion[];
  scenarios: ScenarioConfig[];
  guide: {
    categories: GuideCategory[];
  };
};

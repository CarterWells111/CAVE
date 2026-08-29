import {
  CourseSchema,
  LessonSchema,
  QuizQuestionSchema,
  ScenarioConfigSchema
} from "@cave/contracts";
import { z } from "zod";

import courses from "../data/courses.json";
import guide from "../data/guide.json";
import journeyKnowledge from "../data/journey-knowledge.json";
import journeyOptions from "../data/journey-options.json";
import journeyPractice from "../data/journey-practice.json";
import journeySources from "../data/journey-sources.json";
import journeyUiCopy from "../data/journey-ui-copy.json";
import lessons from "../data/lessons.json";
import quizzes from "../data/quizzes.json";
import scenarios from "../data/scenarios.json";
import type { ContentCatalog } from "./catalog";
import { JourneyContentCatalogSchema } from "./journey-schema";

const GuideCategorySchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1),
  reviewStatus: z.enum(["draft", "reviewed"]),
  reviewedAt: z.string().min(1).optional(),
  sourceRefs: z.array(z.string().min(1))
}).strict();

export const ContentCatalogSchema = z.object({
  courses: z.array(CourseSchema),
  lessons: z.array(LessonSchema),
  quizzes: z.array(QuizQuestionSchema),
  scenarios: z.array(ScenarioConfigSchema),
  guide: z.object({ categories: z.array(GuideCategorySchema) }).strict(),
  journey: JourneyContentCatalogSchema
}).strict();

const checkedInCatalog = {
  courses,
  lessons,
  quizzes,
  scenarios,
  guide,
  journey: {
    options: journeyOptions,
    knowledge: journeyKnowledge,
    practice: journeyPractice,
    sources: journeySources,
    uiCopy: journeyUiCopy
  }
};

export function loadCatalog(): ContentCatalog {
  return ContentCatalogSchema.parse(structuredClone(checkedInCatalog));
}

import {
  CourseSchema,
  LessonSchema,
  QuizQuestionSchema,
  ScenarioConfigSchema
} from "@hackathon/contracts";
import { z } from "zod";

import courses from "../data/courses.json";
import guide from "../data/guide.json";
import lessons from "../data/lessons.json";
import quizzes from "../data/quizzes.json";
import scenarios from "../data/scenarios.json";
import type { ContentCatalog } from "./catalog";

const GuideCategorySchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(1),
    reviewStatus: z.enum(["draft", "reviewed"]),
    reviewedAt: z.string().min(1).optional(),
    sourceRefs: z.array(z.string().min(1))
  })
  .strict();

export const ContentCatalogSchema = z
  .object({
    courses: z.array(CourseSchema),
    lessons: z.array(LessonSchema),
    quizzes: z.array(QuizQuestionSchema),
    scenarios: z.array(ScenarioConfigSchema),
    guide: z
      .object({
        categories: z.array(GuideCategorySchema)
      })
      .strict()
  })
  .strict();

const checkedInCatalog = {
  courses,
  lessons,
  quizzes,
  scenarios,
  guide
};

export function loadCatalog(): ContentCatalog {
  return ContentCatalogSchema.parse(structuredClone(checkedInCatalog));
}

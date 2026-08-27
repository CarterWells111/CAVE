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

const JourneyReviewFields = {
  reviewStatus: z.enum(["draft", "reviewed"]),
  reviewedAt: z.string().min(1).optional()
};

const JourneyOptionSchema = z.object({
  id: z.string().min(1),
  group: z.enum(["expectation", "concern", "behavior", "motivation", "comfort", "health"]),
  order: z.number().int().positive(),
  label: z.string().min(1),
  sourceIds: z.array(z.string().min(1)),
  ...JourneyReviewFields
}).strict();

const JourneyKnowledgeSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().positive(),
  title: z.string().min(1),
  body: z.string().min(1),
  sourceIds: z.array(z.string().min(1)),
  ...JourneyReviewFields
}).strict();

const JourneyPracticeSchema = z.object({
  version: z.string().min(1),
  scripted: z.literal(true),
  phrases: z.array(z.object({
    id: z.string().min(1),
    intent: z.string().min(1),
    order: z.number().int().positive(),
    text: z.string().min(1),
    ...JourneyReviewFields
  }).strict()),
  responses: z.array(z.object({
    id: z.string().min(1),
    branch: z.string().min(1),
    text: z.string().min(1),
    scripted: z.literal(true),
    safeTerminal: z.boolean(),
    ...JourneyReviewFields
  }).strict())
}).strict();

const JourneySourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url(),
  ...JourneyReviewFields
}).strict();

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
      .strict(),
    journey: z.object({
      options: z.array(JourneyOptionSchema),
      knowledge: z.array(JourneyKnowledgeSchema),
      practice: JourneyPracticeSchema,
      sources: z.array(JourneySourceSchema)
    }).strict()
  })
  .strict();

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
    sources: journeySources
  }
};

export function loadCatalog(): ContentCatalog {
  return ContentCatalogSchema.parse(structuredClone(checkedInCatalog));
}

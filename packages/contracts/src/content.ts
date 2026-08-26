import { z } from "zod";

const KEBAB_CASE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const IdSchema = z.string().regex(KEBAB_CASE_ID);
export const ReviewStatusSchema = z.enum(["draft", "reviewed"]);
export const ScenarioStageSchema = z.enum([
  "setup",
  "opening",
  "response",
  "clarification",
  "resolution",
  "debrief",
  "safety_stop"
]);
export const StopRuleCodeSchema = z.enum([
  "explicit_exit",
  "max_turns",
  "clear_boundary",
  "danger",
  "violence",
  "self_harm",
  "medical_emergency",
  "minor"
]);
export const DebriefKeySchema = z.enum([
  "feeling",
  "willingness",
  "boundary",
  "next_step"
]);

const VersionSchema = z.number().int().positive();
const SourceRefsSchema = z.array(z.string().min(1));

const TextBlockSchema = z
  .object({
    id: IdSchema,
    kind: z.literal("text"),
    body: z.string().min(1)
  })
  .strict();

const ImageBlockSchema = z
  .object({
    id: IdSchema,
    kind: z.literal("image"),
    assetId: IdSchema,
    alt: z.string().min(1)
  })
  .strict();

const CalloutBlockSchema = z
  .object({
    id: IdSchema,
    kind: z.literal("callout"),
    tone: z.enum(["info", "caution"]),
    body: z.string().min(1)
  })
  .strict();

export const LessonBlockSchema = z.discriminatedUnion("kind", [
  TextBlockSchema,
  ImageBlockSchema,
  CalloutBlockSchema
]);

export const CourseSchema = z
  .object({
    id: IdSchema,
    version: VersionSchema,
    title: z.string().min(1),
    moduleIds: z.array(IdSchema),
    reviewStatus: ReviewStatusSchema,
    reviewedAt: z.string().min(1).optional(),
    sourceRefs: SourceRefsSchema
  })
  .strict();

export const LessonSchema = z
  .object({
    id: IdSchema,
    version: VersionSchema,
    courseId: IdSchema,
    order: z.number().int().positive(),
    title: z.string().min(1),
    blocks: z.array(LessonBlockSchema),
    quizIds: z.array(IdSchema),
    linkedScenarioIds: z.array(IdSchema),
    reviewStatus: ReviewStatusSchema,
    reviewedAt: z.string().min(1).optional(),
    sourceRefs: SourceRefsSchema
  })
  .strict();

const QuizOptionSchema = z
  .object({
    id: IdSchema,
    text: z.string().min(1),
    isCorrect: z.boolean(),
    feedback: z.string().min(1)
  })
  .strict();

export const QuizQuestionSchema = z
  .object({
    id: IdSchema,
    lessonId: IdSchema,
    prompt: z.string().min(1),
    options: z.array(QuizOptionSchema).min(1)
  })
  .strict();

export const StopRuleSchema = z
  .object({
    code: StopRuleCodeSchema,
    terminalStage: z.enum(["resolution", "safety_stop"])
  })
  .strict();

export const DebriefRubricSchema = z
  .object({
    dimensions: z.array(DebriefKeySchema)
  })
  .strict();

export const ScenarioConfigSchema = z
  .object({
    id: IdSchema,
    version: VersionSchema,
    title: z.string().min(1),
    allowedStages: z.array(ScenarioStageSchema),
    maxTurns: z.number().int().min(1).max(8),
    learningObjectives: z.array(z.string().min(1)),
    allowedPressureLevel: z.union([z.literal(0), z.literal(1)]),
    stopRules: z.array(StopRuleSchema),
    debriefRubric: DebriefRubricSchema,
    linkedLessonIds: z.array(IdSchema),
    reviewStatus: ReviewStatusSchema,
    reviewedAt: z.string().min(1).optional(),
    sourceRefs: SourceRefsSchema
  })
  .strict();

export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;
export type ScenarioStage = z.infer<typeof ScenarioStageSchema>;
export type StopRuleCode = z.infer<typeof StopRuleCodeSchema>;
export type DebriefKey = z.infer<typeof DebriefKeySchema>;
export type LessonBlock = z.infer<typeof LessonBlockSchema>;
export type Course = z.infer<typeof CourseSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type StopRule = z.infer<typeof StopRuleSchema>;
export type DebriefRubric = z.infer<typeof DebriefRubricSchema>;
export type ScenarioConfig = z.infer<typeof ScenarioConfigSchema>;

import { describe, expect, it } from "vitest";

import {
  CourseSchema,
  LessonSchema,
  QuizQuestionSchema,
  ScenarioConfigSchema
} from "./content";

const course = {
  id: "cave-basics",
  version: 1,
  title: "身体与声音基础",
  moduleIds: ["lesson-boundaries"],
  reviewStatus: "draft",
  sourceRefs: ["source-intro"]
};

const lesson = {
  id: "lesson-boundaries",
  version: 1,
  courseId: course.id,
  order: 1,
  title: "边界表达",
  blocks: [
    { id: "opening-text", kind: "text", body: "先感受，再表达。" },
    {
      id: "boundary-callout",
      kind: "callout",
      tone: "info",
      body: "清楚并不等于强硬。"
    }
  ],
  quizIds: ["quiz-boundary"],
  linkedScenarioIds: ["scenario-boundary"],
  reviewStatus: "draft",
  sourceRefs: ["source-intro"]
};

const quiz = {
  id: "quiz-boundary",
  lessonId: lesson.id,
  prompt: "哪一句更清楚？",
  options: [
    {
      id: "option-clear",
      text: "我现在不愿意继续。",
      isCorrect: true,
      feedback: "这句话表达了清楚的边界。"
    }
  ]
};

const scenario = {
  id: "scenario-boundary",
  version: 1,
  title: "拒绝额外请求",
  allowedStages: ["setup", "opening", "response", "resolution", "debrief"],
  maxTurns: 4,
  learningObjectives: ["表达边界"],
  allowedPressureLevel: 0,
  stopRules: [
    { code: "explicit_exit", terminalStage: "resolution" },
    { code: "danger", terminalStage: "safety_stop" }
  ],
  debriefRubric: {
    dimensions: ["feeling", "willingness", "boundary", "next_step"]
  },
  linkedLessonIds: [lesson.id],
  reviewStatus: "draft",
  sourceRefs: ["source-intro"]
};

describe("content contracts", () => {
  it("parses valid version one content", () => {
    expect(CourseSchema.parse(course)).toEqual(course);
    expect(LessonSchema.parse(lesson)).toEqual(lesson);
    expect(QuizQuestionSchema.parse(quiz)).toEqual(quiz);
    expect(ScenarioConfigSchema.parse(scenario)).toEqual(scenario);
  });

  it.each([
    [CourseSchema, { ...course, unexpected: true }],
    [LessonSchema, { ...lesson, title: undefined }],
    [QuizQuestionSchema, { ...quiz, id: "Not Kebab Case" }],
    [ScenarioConfigSchema, { ...scenario, maxTurns: 9 }],
    [ScenarioConfigSchema, { ...scenario, allowedPressureLevel: 2 }]
  ])("rejects invalid or unknown content fields", (schema, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });
});

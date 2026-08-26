import type { ReviewStatus, StopRuleCode } from "@hackathon/contracts";

import type { ContentCatalog, GuideCategory } from "./catalog";
import { ContentCatalogSchema } from "./load";

export type ContentValidationMode = "draft" | "production";

export type ContentValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export class ContentValidationError extends Error {
  constructor(public readonly issues: ContentValidationIssue[]) {
    super(`Content validation failed with ${issues.length} issue(s)`);
    this.name = "ContentValidationError";
  }
}

type Reviewable = {
  id: string;
  reviewStatus: ReviewStatus;
  reviewedAt?: string | undefined;
  sourceRefs: string[];
};

const SAFETY_CODES = new Set<StopRuleCode>([
  "danger",
  "violence",
  "self_harm",
  "medical_emergency",
  "minor"
]);

function addIssue(
  issues: ContentValidationIssue[],
  code: string,
  path: string,
  message: string
) {
  issues.push({ code, path, message });
}

function validateUniqueIds(catalog: ContentCatalog, issues: ContentValidationIssue[]) {
  const ids = new Map<string, string>();
  const entities = [
    ...catalog.courses.map((item) => [item.id, `courses.${item.id}`] as const),
    ...catalog.lessons.map((item) => [item.id, `lessons.${item.id}`] as const),
    ...catalog.quizzes.map((item) => [item.id, `quizzes.${item.id}`] as const),
    ...catalog.scenarios.map((item) => [item.id, `scenarios.${item.id}`] as const),
    ...catalog.guide.categories.map(
      (item) => [item.id, `guide.categories.${item.id}`] as const
    )
  ];

  for (const [id, path] of entities) {
    const previous = ids.get(id);
    if (previous) {
      addIssue(issues, "DUPLICATE_ID", path, `${id} duplicates ${previous}`);
    } else {
      ids.set(id, path);
    }
  }
}

function validateReviewable(
  item: Reviewable | GuideCategory,
  path: string,
  mode: ContentValidationMode,
  issues: ContentValidationIssue[]
) {
  if (item.sourceRefs.length === 0) {
    addIssue(issues, "MISSING_SOURCE_REFS", path, `${item.id} has no source refs`);
  }

  if (item.reviewStatus === "reviewed" && !item.reviewedAt) {
    addIssue(
      issues,
      "REVIEW_DATE_REQUIRED",
      path,
      `${item.id} is reviewed without reviewedAt`
    );
  }

  if (mode === "production" && item.reviewStatus === "draft") {
    addIssue(issues, "DRAFT_CONTENT", path, `${item.id} is still draft`);
  }
}

function validateCourseOrder(catalog: ContentCatalog, issues: ContentValidationIssue[]) {
  for (const course of catalog.courses) {
    const lessons = catalog.lessons
      .filter((lesson) => lesson.courseId === course.id)
      .sort((left, right) => left.order - right.order);
    const orders = new Set<number>();

    for (const lesson of lessons) {
      if (orders.has(lesson.order)) {
        addIssue(
          issues,
          "DUPLICATE_ORDER",
          `lessons.${lesson.id}.order`,
          `order ${lesson.order} is duplicated in ${course.id}`
        );
      }
      orders.add(lesson.order);
    }

    if (lessons.map((lesson) => lesson.id).join("|") !== course.moduleIds.join("|")) {
      addIssue(
        issues,
        "COURSE_ORDER_MISMATCH",
        `courses.${course.id}.moduleIds`,
        "moduleIds must match lessons sorted by order"
      );
    }
  }
}

function validateReferences(catalog: ContentCatalog, issues: ContentValidationIssue[]) {
  const lessonById = new Map(catalog.lessons.map((lesson) => [lesson.id, lesson]));
  const scenarioById = new Map(
    catalog.scenarios.map((scenario) => [scenario.id, scenario])
  );

  for (const course of catalog.courses) {
    for (const lessonId of course.moduleIds) {
      if (!lessonById.has(lessonId)) {
        addIssue(
          issues,
          "MISSING_LESSON",
          `courses.${course.id}.moduleIds`,
          `missing lesson ${lessonId}`
        );
      }
    }
  }

  for (const quiz of catalog.quizzes) {
    if (!lessonById.has(quiz.lessonId)) {
      addIssue(
        issues,
        "MISSING_LESSON",
        `quizzes.${quiz.id}.lessonId`,
        `missing lesson ${quiz.lessonId}`
      );
    }
  }

  for (const lesson of catalog.lessons) {
    for (const scenarioId of lesson.linkedScenarioIds) {
      const scenario = scenarioById.get(scenarioId);
      if (!scenario) {
        addIssue(
          issues,
          "MISSING_SCENARIO",
          `lessons.${lesson.id}.linkedScenarioIds`,
          `missing scenario ${scenarioId}`
        );
      } else if (!scenario.linkedLessonIds.includes(lesson.id)) {
        addIssue(
          issues,
          "MISSING_LESSON_BACKLINK",
          `scenarios.${scenario.id}.linkedLessonIds`,
          `${scenario.id} does not link back to ${lesson.id}`
        );
      }
    }
  }

  for (const scenario of catalog.scenarios) {
    for (const lessonId of scenario.linkedLessonIds) {
      const lesson = lessonById.get(lessonId);
      if (!lesson) {
        addIssue(
          issues,
          "MISSING_LESSON",
          `scenarios.${scenario.id}.linkedLessonIds`,
          `missing lesson ${lessonId}`
        );
      } else if (!lesson.linkedScenarioIds.includes(scenario.id)) {
        addIssue(
          issues,
          "MISSING_SCENARIO_BACKLINK",
          `lessons.${lesson.id}.linkedScenarioIds`,
          `${lesson.id} does not link back to ${scenario.id}`
        );
      }
    }
  }
}

function validateScenarioRounds(catalog: ContentCatalog, issues: ContentValidationIssue[]) {
  for (const scenario of catalog.scenarios) {
    const stages = new Set(scenario.allowedStages);
    for (const required of ["setup", "opening", "response", "resolution", "debrief"] as const) {
      if (!stages.has(required)) {
        addIssue(
          issues,
          "INCOMPLETE_SCENARIO_ROUNDS",
          `scenarios.${scenario.id}.allowedStages`,
          `missing required stage ${required}`
        );
      }
    }

    if (stages.size !== scenario.allowedStages.length) {
      addIssue(
        issues,
        "DUPLICATE_STAGE",
        `scenarios.${scenario.id}.allowedStages`,
        "allowedStages contains duplicates"
      );
    }

    for (const rule of scenario.stopRules) {
      const expected = SAFETY_CODES.has(rule.code) ? "safety_stop" : "resolution";
      if (rule.terminalStage !== expected) {
        addIssue(
          issues,
          "INVALID_STOP_RULE",
          `scenarios.${scenario.id}.stopRules`,
          `${rule.code} must terminate at ${expected}`
        );
      }
    }
  }
}

export function validateCatalog(
  input: unknown,
  options: { mode: ContentValidationMode }
): ContentCatalog {
  const parsed = ContentCatalogSchema.safeParse(input);
  if (!parsed.success) {
    throw new ContentValidationError(
      parsed.error.issues.map((issue) => ({
        code: "SCHEMA_INVALID",
        path: issue.path.join("."),
        message: issue.message
      }))
    );
  }

  const catalog = parsed.data;
  const issues: ContentValidationIssue[] = [];
  validateUniqueIds(catalog, issues);
  validateCourseOrder(catalog, issues);
  validateReferences(catalog, issues);
  validateScenarioRounds(catalog, issues);

  for (const [collection, items] of [
    ["courses", catalog.courses],
    ["lessons", catalog.lessons],
    ["scenarios", catalog.scenarios],
    ["guide.categories", catalog.guide.categories]
  ] as const) {
    for (const item of items) {
      validateReviewable(item, `${collection}.${item.id}`, options.mode, issues);
    }
  }

  if (issues.length > 0) {
    throw new ContentValidationError(issues);
  }

  return catalog;
}

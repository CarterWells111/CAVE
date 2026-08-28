import type { ReviewStatus, StopRuleCode } from "@cave/contracts";

import type {
  ContentCatalog,
  GuideCategory,
  JourneyCopyMetadata,
  JourneyReviewStatus
} from "./catalog";
import { ContentCatalogSchema } from "./load";
import { JOURNEY_SOURCE_REGISTRY } from "./source-registry";

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

type Ordered = { id: string; order: number };

const SAFETY_CODES = new Set<StopRuleCode>([
  "danger",
  "violence",
  "self_harm",
  "medical_emergency",
  "minor"
]);

const REQUIRED_SOURCE_IDS = Array.from(
  { length: 14 },
  (_, index) => `SRC-${String(index + 1).padStart(3, "0")}`
);

function addIssue(
  issues: ContentValidationIssue[],
  code: string,
  path: string,
  message: string
) {
  issues.push({ code, path, message });
}

function journeyReviewables(catalog: ContentCatalog): JourneyCopyMetadata[] {
  return [
    ...catalog.journey.options,
    ...catalog.journey.knowledge,
    ...catalog.journey.practice.phrases,
    ...catalog.journey.practice.responses,
    ...catalog.journey.practice.partnerResponses,
    ...catalog.journey.practice.safetyBranches,
    ...catalog.journey.practice.supportResources,
    catalog.journey.uiCopy.bodyKnowledgeDefinition,
    ...catalog.journey.uiCopy.behaviorMapPoints,
    ...catalog.journey.uiCopy.attitudes,
    ...catalog.journey.uiCopy.communicationSections
  ];
}

function validateUniqueIds(catalog: ContentCatalog, issues: ContentValidationIssue[]) {
  const ids = new Map<string, string>();
  const entities = [
    ...catalog.courses.map((item) => [item.id, `courses.${item.id}`] as const),
    ...catalog.lessons.map((item) => [item.id, `lessons.${item.id}`] as const),
    ...catalog.quizzes.map((item) => [item.id, `quizzes.${item.id}`] as const),
    ...catalog.scenarios.map((item) => [item.id, `scenarios.${item.id}`] as const),
    ...catalog.guide.categories.map((item) => [item.id, `guide.categories.${item.id}`] as const),
    ...catalog.journey.sources.map((item) => [item.id, `journey.sources.${item.id}`] as const),
    ...journeyReviewables(catalog).map((item) => [item.id, `journey.${item.id}`] as const)
  ];

  for (const [id, path] of entities) {
    const previous = ids.get(id);
    if (previous) addIssue(issues, "DUPLICATE_ID", path, `${id} duplicates ${previous}`);
    else ids.set(id, path);
  }
}

function validateOrder(items: Ordered[], path: string, issues: ContentValidationIssue[]) {
  const orders = new Set<number>();
  for (const item of items) {
    if (orders.has(item.order)) {
      addIssue(issues, "DUPLICATE_ORDER", `${path}.${item.id}.order`, `${item.order} is duplicated`);
    }
    orders.add(item.order);
  }
}

function matchesSequence(actual: readonly string[], expected: readonly string[]) {
  return actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function productionReviewIssue(status: JourneyReviewStatus): string | undefined {
  if (status === "draft") return "DRAFT_CONTENT";
  if (status === "expert_review_pending") return "EXPERT_REVIEW_PENDING";
  if (status === "revision_required") return "REVISION_REQUIRED";
  return undefined;
}

function validateJourneyReview(
  item: JourneyCopyMetadata,
  path: string,
  mode: ContentValidationMode,
  issues: ContentValidationIssue[]
) {
  const evidence = [
    item.reviewer,
    item.reviewerRole,
    item.reviewedAt,
    item.reviewedVersion,
    item.reviewConclusion
  ];
  if (item.reviewStatus === "reviewed" && evidence.some((value) => value === undefined)) {
    addIssue(
      issues,
      "REVIEW_EVIDENCE_REQUIRED",
      path,
      `${item.id} requires reviewer, role, date, version, and conclusion`
    );
  }
  if (item.reviewStatus !== "reviewed" && evidence.some((value) => value !== undefined)) {
    addIssue(issues, "UNEXPECTED_REVIEW_EVIDENCE", path, `${item.id} has evidence without reviewed status`);
  }
  if (mode === "production") {
    const code = productionReviewIssue(item.reviewStatus);
    if (code) addIssue(issues, code, path, `${item.id} is ${item.reviewStatus}`);
  }
}

function validateJourney(catalog: ContentCatalog, mode: ContentValidationMode, issues: ContentValidationIssue[]) {
  const { journey } = catalog;
  const sourceIds = new Set(journey.sources.map(({ id }) => id));
  const actualSourceIds = [...sourceIds].sort();
  if (actualSourceIds.join("|") !== REQUIRED_SOURCE_IDS.join("|")
    || JSON.stringify(journey.sources) !== JSON.stringify(JOURNEY_SOURCE_REGISTRY)) {
    addIssue(
      issues,
      "INVALID_SOURCE_REGISTRY",
      "journey.sources",
      "journey sources must exactly match the approved SRC-001 through SRC-014 registry"
    );
  }
  if (journey.sources.some(({ url }) => url.includes("example.invalid"))) {
    addIssue(issues, "PLACEHOLDER_SOURCE", "journey.sources", "placeholder source URL remains");
  }
  for (const source of journey.sources) {
    if (mode === "production" && source.verificationStatus !== "source_verified") {
      addIssue(issues, "SOURCE_REVISION_REQUIRED", `journey.sources.${source.id}`, `${source.id} is not verified`);
    }
  }

  validateOrder(journey.options, "journey.options", issues);
  validateOrder(journey.knowledge, "journey.knowledge", issues);
  validateOrder(journey.practice.phrases, "journey.practice.phrases", issues);
  validateOrder(journey.practice.partnerResponses, "journey.practice.partnerResponses", issues);
  validateOrder(journey.practice.safetyBranches, "journey.practice.safetyBranches", issues);
  validateOrder(journey.practice.supportResources, "journey.practice.supportResources", issues);
  validateOrder(journey.uiCopy.behaviorMapPoints, "journey.uiCopy.behaviorMapPoints", issues);
  validateOrder(journey.uiCopy.attitudes, "journey.uiCopy.attitudes", issues);
  validateOrder(journey.uiCopy.communicationSections, "journey.uiCopy.communicationSections", issues);

  for (const item of journeyReviewables(catalog)) {
    if (["MED", "EDU", "REVIEW"].includes(item.contentType) && item.sourceIds.length === 0) {
      addIssue(issues, "MISSING_SOURCE_REFS", `journey.${item.id}`, `${item.id} has no source ids`);
    }
    for (const sourceId of item.sourceIds) {
      if (!sourceIds.has(sourceId)) {
        addIssue(issues, "MISSING_SOURCE", `journey.${item.id}.sourceIds`, `missing source ${sourceId}`);
      }
    }
    validateJourneyReview(item, `journey.${item.id}`, mode, issues);
  }

  const optionPages = {
    expectation: 2,
    concern: 2,
    behavior: 4,
    motivation: 5,
    comfort: 5,
    health: 7
  } as const;
  const wrongPageItems = [
    ...journey.options.filter((item) => item.page !== optionPages[item.group]),
    ...journey.knowledge.filter((item) => item.page !== 3),
    ...journey.practice.phrases.filter((item) => item.page !== 6),
    ...journey.practice.responses.filter((item) => item.page !== 6),
    ...journey.practice.partnerResponses.filter((item) => item.page !== 6),
    ...journey.practice.safetyBranches.filter((item) => item.page !== 6),
    ...journey.practice.supportResources.filter((item) => item.page !== 6),
    ...[journey.uiCopy.bodyKnowledgeDefinition].filter((item) => item.page !== 3),
    ...journey.uiCopy.behaviorMapPoints.filter((item) => item.page !== 4),
    ...journey.uiCopy.attitudes.filter((item) => item.page !== 4),
    ...journey.uiCopy.communicationSections.filter((item) => item.page !== 7)
  ];
  for (const item of wrongPageItems) {
    addIssue(
      issues,
      "INVALID_PAGE_OWNERSHIP",
      `journey.${item.id}.page`,
      `${item.id} is assigned to Page ${item.page}`
    );
  }

  const behaviorIds = new Set(
    journey.options.filter(({ group }) => group === "behavior").map(({ id }) => id)
  );
  for (const point of journey.uiCopy.behaviorMapPoints) {
    for (const behaviorId of point.behaviorIds) {
      if (!behaviorIds.has(behaviorId)) {
        addIssue(issues, "MISSING_BEHAVIOR", `journey.${point.id}.behaviorIds`, `missing ${behaviorId}`);
      }
    }
  }

  const expectedBranches = new Set(["supportive", "disappointed-follow-up", "ignores-pause"]);
  const responseBranches = journey.practice.responses.map(({ branch }) => branch);
  const branchSet = new Set(responseBranches);
  if (responseBranches.length !== expectedBranches.size
    || branchSet.size !== expectedBranches.size
    || [...expectedBranches].some((branch) => !branchSet.has(branch))) {
    addIssue(issues, "INVALID_PRACTICE_CATALOG", "journey.practice.responses", "practice requires one compatibility response for each supported branch");
  }
  if (journey.practice.responses.find(({ branch }) => branch === "ignores-pause")?.safeTerminal !== true
    || !journey.practice.safetyBranches.some(({ safeTerminal }) => safeTerminal)) {
    addIssue(issues, "INVALID_PRACTICE_CATALOG", "journey.practice", "unsafe pressure must end in a safe terminal branch");
  }

  const requiredIntents = [
    "slow-down",
    "adjust-touch",
    "pause-and-decide",
    "stop-current-action",
    "choose-another-closeness",
    "pause-to-feel"
  ];
  if (!matchesSequence(journey.practice.phrases.map(({ intent }) => intent), requiredIntents)
    || !matchesSequence(journey.practice.partnerResponses.map(({ intent }) => intent), requiredIntents)) {
    addIssue(issues, "INVALID_PRACTICE_CATALOG", "journey.practice", "six ordered intents and partner responses are required");
  }
  const requiredAttitudes = [
    "expecting",
    "familiar-enjoyed",
    "decide-in-moment",
    "unsure",
    "not-this-time",
    "skip"
  ];
  const requiredSupportNumbers = ["110", "120", "12338", "12348"];
  const requiredDisappointedResponses = [
    "刚才愿意，不代表我现在也愿意。我想先停下来。",
    "我知道你可能失望，但我现在不想继续。",
    "我现在不想解释，请先给我一点空间。"
  ];
  const disappointedResponses = journey.practice.safetyBranches.find(
    ({ branch }) => branch === "disappointed-but-stops"
  )?.userTexts ?? [];
  if (!matchesSequence(disappointedResponses, requiredDisappointedResponses)) {
    addIssue(
      issues,
      "INVALID_PRACTICE_CATALOG",
      "journey.practice.safetyBranches",
      "the disappointed-but-stops branch requires all three approved user responses in order"
    );
  }
  if (journey.uiCopy.behaviorMapPoints.length !== 9
    || !matchesSequence(journey.uiCopy.attitudes.map(({ value }) => value), requiredAttitudes)
    || !matchesSequence(journey.practice.supportResources.map(({ number }) => number), requiredSupportNumbers)
    || journey.uiCopy.communicationSections.length !== 7) {
    addIssue(issues, "INCOMPLETE_SEVEN_SCREEN_CATALOG", "journey", "required seven-screen collections are incomplete");
  }
}

function validateReviewable(
  item: Reviewable | GuideCategory,
  path: string,
  mode: ContentValidationMode,
  issues: ContentValidationIssue[]
) {
  if (item.sourceRefs.length === 0) addIssue(issues, "MISSING_SOURCE_REFS", path, `${item.id} has no source refs`);
  if (item.reviewStatus === "reviewed" && !item.reviewedAt) {
    addIssue(issues, "REVIEW_DATE_REQUIRED", path, `${item.id} is reviewed without reviewedAt`);
  }
  if (mode === "production" && item.reviewStatus === "draft") {
    addIssue(issues, "DRAFT_CONTENT", path, `${item.id} is still draft`);
  }
}

function validateCourseOrder(catalog: ContentCatalog, issues: ContentValidationIssue[]) {
  for (const course of catalog.courses) {
    const lessons = catalog.lessons.filter((lesson) => lesson.courseId === course.id)
      .sort((left, right) => left.order - right.order);
    const orders = new Set<number>();
    for (const lesson of lessons) {
      if (orders.has(lesson.order)) addIssue(issues, "DUPLICATE_ORDER", `lessons.${lesson.id}.order`, `order ${lesson.order} is duplicated in ${course.id}`);
      orders.add(lesson.order);
    }
    if (lessons.map(({ id }) => id).join("|") !== course.moduleIds.join("|")) {
      addIssue(issues, "COURSE_ORDER_MISMATCH", `courses.${course.id}.moduleIds`, "moduleIds must match lessons sorted by order");
    }
  }
}

function validateReferences(catalog: ContentCatalog, issues: ContentValidationIssue[]) {
  const lessonById = new Map(catalog.lessons.map((lesson) => [lesson.id, lesson]));
  const scenarioById = new Map(catalog.scenarios.map((scenario) => [scenario.id, scenario]));
  for (const course of catalog.courses) {
    for (const lessonId of course.moduleIds) {
      if (!lessonById.has(lessonId)) addIssue(issues, "MISSING_LESSON", `courses.${course.id}.moduleIds`, `missing lesson ${lessonId}`);
    }
  }
  for (const quiz of catalog.quizzes) {
    if (!lessonById.has(quiz.lessonId)) addIssue(issues, "MISSING_LESSON", `quizzes.${quiz.id}.lessonId`, `missing lesson ${quiz.lessonId}`);
  }
  for (const lesson of catalog.lessons) {
    for (const scenarioId of lesson.linkedScenarioIds) {
      const scenario = scenarioById.get(scenarioId);
      if (!scenario) addIssue(issues, "MISSING_SCENARIO", `lessons.${lesson.id}.linkedScenarioIds`, `missing scenario ${scenarioId}`);
      else if (!scenario.linkedLessonIds.includes(lesson.id)) addIssue(issues, "MISSING_LESSON_BACKLINK", `scenarios.${scenario.id}.linkedLessonIds`, `${scenario.id} does not link back to ${lesson.id}`);
    }
  }
  for (const scenario of catalog.scenarios) {
    for (const lessonId of scenario.linkedLessonIds) {
      const lesson = lessonById.get(lessonId);
      if (!lesson) addIssue(issues, "MISSING_LESSON", `scenarios.${scenario.id}.linkedLessonIds`, `missing lesson ${lessonId}`);
      else if (!lesson.linkedScenarioIds.includes(scenario.id)) addIssue(issues, "MISSING_SCENARIO_BACKLINK", `lessons.${lesson.id}.linkedScenarioIds`, `${lesson.id} does not link back to ${scenario.id}`);
    }
  }
}

function validateScenarioRounds(catalog: ContentCatalog, issues: ContentValidationIssue[]) {
  for (const scenario of catalog.scenarios) {
    const stages = new Set(scenario.allowedStages);
    for (const required of ["setup", "opening", "response", "resolution", "debrief"] as const) {
      if (!stages.has(required)) addIssue(issues, "INCOMPLETE_SCENARIO_ROUNDS", `scenarios.${scenario.id}.allowedStages`, `missing required stage ${required}`);
    }
    if (stages.size !== scenario.allowedStages.length) addIssue(issues, "DUPLICATE_STAGE", `scenarios.${scenario.id}.allowedStages`, "allowedStages contains duplicates");
    for (const rule of scenario.stopRules) {
      const expected = SAFETY_CODES.has(rule.code) ? "safety_stop" : "resolution";
      if (rule.terminalStage !== expected) addIssue(issues, "INVALID_STOP_RULE", `scenarios.${scenario.id}.stopRules`, `${rule.code} must terminate at ${expected}`);
    }
  }
}

export function validateCatalog(input: unknown, options: { mode: ContentValidationMode }): ContentCatalog {
  const parsed = ContentCatalogSchema.safeParse(input);
  if (!parsed.success) {
    throw new ContentValidationError(parsed.error.issues.map((issue) => ({
      code: "SCHEMA_INVALID",
      path: issue.path.join("."),
      message: issue.message
    })));
  }
  const catalog = parsed.data;
  const issues: ContentValidationIssue[] = [];
  validateUniqueIds(catalog, issues);
  validateCourseOrder(catalog, issues);
  validateReferences(catalog, issues);
  validateScenarioRounds(catalog, issues);
  validateJourney(catalog, options.mode, issues);
  for (const [collection, items] of [
    ["courses", catalog.courses],
    ["lessons", catalog.lessons],
    ["scenarios", catalog.scenarios],
    ["guide.categories", catalog.guide.categories]
  ] as const) {
    for (const item of items) validateReviewable(item, `${collection}.${item.id}`, options.mode, issues);
  }
  if (issues.length > 0) throw new ContentValidationError(issues);
  return catalog;
}

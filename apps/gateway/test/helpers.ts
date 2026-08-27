import type {
  DebriefRequest,
  PracticeTurnRequest,
  ScenarioConfig
} from "@cave/contracts";

export const TEST_SCENARIO: ScenarioConfig = {
  id: "scenario-boundary",
  version: 1,
  title: "拒绝额外请求",
  allowedStages: [
    "setup",
    "opening",
    "response",
    "clarification",
    "resolution",
    "debrief",
    "safety_stop"
  ],
  maxTurns: 4,
  learningObjectives: ["辨认感受", "表达意愿", "说出边界", "提出下一步"],
  allowedPressureLevel: 1,
  stopRules: [
    { code: "explicit_exit", terminalStage: "resolution" },
    { code: "max_turns", terminalStage: "resolution" },
    { code: "clear_boundary", terminalStage: "resolution" },
    { code: "danger", terminalStage: "safety_stop" }
  ],
  debriefRubric: {
    dimensions: ["feeling", "willingness", "boundary", "next_step"]
  },
  linkedLessonIds: ["lesson-boundaries"],
  reviewStatus: "reviewed",
  reviewedAt: "2026-08-27T05:51:49Z",
  sourceRefs: ["source-editorial-draft"]
};

export const VALID_TURN_REQUEST: PracticeTurnRequest = {
  contractVersion: "1",
  requestId: "request-turn-1",
  installationToken: "installation-secret-canary",
  locale: "zh-CN",
  scenarioId: TEST_SCENARIO.id,
  scenarioVersion: TEST_SCENARIO.version,
  scenarioStage: "setup",
  selectedOptions: { setting: "workplace" },
  recentTurns: [],
  userMessage: "我想练习清楚地拒绝额外请求。"
};

export const VALID_DEBRIEF_REQUEST: DebriefRequest = {
  contractVersion: "1",
  requestId: "request-debrief-1",
  installationToken: "installation-secret-canary",
  locale: "zh-CN",
  scenarioId: TEST_SCENARIO.id,
  scenarioVersion: TEST_SCENARIO.version,
  turns: [
    { role: "assistant", text: "你可以再多做一点吗？" },
    {
      role: "user",
      text: "我有一点紧张，但我今天不能继续。我需要停下来，我们明天再确认。"
    }
  ]
};

export const SAFE_DECISION = {
  level: "safe",
  reasonCode: "none"
} as const;

export const scenarioSource = {
  getScenario(id: string) {
    return id === TEST_SCENARIO.id ? structuredClone(TEST_SCENARIO) : undefined;
  }
};

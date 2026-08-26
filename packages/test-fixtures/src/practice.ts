import type {
  DebriefResponse,
  PracticeTurnRequest
} from "@hackathon/contracts";
import type { ScenarioEvent } from "@hackathon/scenario-engine";

export const validPracticeRequest: PracticeTurnRequest = {
  contractVersion: "1",
  requestId: "fixture-request-1",
  installationToken: "fixture-installation",
  locale: "zh-CN",
  scenarioId: "scenario-boundary",
  scenarioVersion: 1,
  scenarioStage: "setup",
  selectedOptions: { setting: "workplace" },
  recentTurns: [],
  userMessage: "我想练习清楚地拒绝额外请求。"
};

export const mockTurnSequence: ScenarioEvent[] = [
  {
    candidateStage: "opening",
    safety: { level: "safe", reasonCode: "none" }
  },
  {
    candidateStage: "response",
    safety: { level: "safe", reasonCode: "none" }
  },
  {
    candidateStage: "response",
    safety: { level: "safe", reasonCode: "none" },
    stopCode: "clear_boundary"
  }
];

export const validDebrief: DebriefResponse = {
  contractVersion: "1",
  requestId: "fixture-debrief-1",
  dimensions: [
    {
      key: "feeling",
      status: "expressed",
      evidenceQuote: "我有一点紧张",
      explanation: "表达了当下的感受。"
    },
    {
      key: "willingness",
      status: "expressed",
      evidenceQuote: "我今天不能继续帮忙",
      explanation: "说明了当下的意愿。"
    },
    {
      key: "boundary",
      status: "expressed",
      evidenceQuote: "我需要在这里停下来",
      explanation: "边界具体且清楚。"
    },
    {
      key: "next_step",
      status: "expressed",
      evidenceQuote: "我们明天下午再确认",
      explanation: "给出了可执行的下一步。"
    }
  ],
  expressionCard: {
    feeling: "我有一点紧张",
    willingness: "我今天不能继续帮忙",
    boundary: "我需要在这里停下来",
    nextStep: "我们明天下午再确认"
  },
  linkedLessonIds: ["lesson-boundaries"],
  promptVersion: "2026-08-26.1",
  policyVersion: "2026-08-26.1"
};

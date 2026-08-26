export type InvalidContractCase = {
  id: string;
  kind: "api-error" | "practice-request" | "safety-decision";
  value: unknown;
};

export const invalidContractCases: InvalidContractCase[] = [
  {
    id: "wrong-contract-version",
    kind: "practice-request",
    value: {
      contractVersion: "2",
      requestId: "invalid-1",
      installationToken: "fixture-installation",
      locale: "zh-CN",
      scenarioId: "scenario-boundary",
      scenarioVersion: 1,
      scenarioStage: "setup",
      selectedOptions: {},
      recentTurns: [],
      userMessage: "测试"
    }
  },
  {
    id: "safe-with-stop-reason",
    kind: "safety-decision",
    value: { level: "safe", reasonCode: "danger" }
  },
  {
    id: "unknown-api-error",
    kind: "api-error",
    value: {
      contractVersion: "1",
      requestId: "invalid-2",
      code: "UNKNOWN_ERROR",
      messageKey: "errors.unknown"
    }
  }
];

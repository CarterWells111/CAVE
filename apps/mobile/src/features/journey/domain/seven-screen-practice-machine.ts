import type { JourneyPracticeCatalog } from "@cave/content";

import type { PracticeIntent } from "./practice-types";

export type SevenScreenPracticeStage =
  | "entry"
  | "behavior"
  | "need"
  | "editable-phrase"
  | "respectful-response"
  | "aftercare"
  | "optional-branch"
  | "optional-response"
  | "safety-resources"
  | "completed";

export type OptionalPracticeBranch =
  | "skip"
  | "disappointed-but-stops"
  | "continues-pressure"
  | "ignores-or-blocks-exit";

export type SevenScreenPracticeState = {
  stage: SevenScreenPracticeStage;
  scripted: true;
  catalogVersion: string;
  mirrorConfirmed: boolean;
  behaviorId?: string | null;
  intent?: PracticeIntent;
  phrase?: string;
  phraseEdited: boolean;
  partnerResponse?: string;
  aftercareId?: string;
  optionalBranch?: Exclude<OptionalPracticeBranch, "skip">;
  optionalPartnerText?: string;
  optionalUserTexts?: string[];
  optionalUserResponse?: string;
  optionalUserResponseEdited?: boolean;
  optionalGuidance?: string;
  safetyEnded: boolean;
  pointEventKey?: string;
  phraseByIntent: Record<PracticeIntent, string>;
};

const INTENTS: readonly PracticeIntent[] = [
  "slow-down",
  "adjust-touch",
  "pause-and-decide",
  "stop-current-action",
  "choose-another-closeness",
  "pause-to-feel"
];

function requireStage(state: SevenScreenPracticeState, allowed: SevenScreenPracticeStage[]) {
  if (!allowed.includes(state.stage)) throw new Error(`invalid-practice-stage:${state.stage}`);
}

export function beginPractice(catalog: JourneyPracticeCatalog): SevenScreenPracticeState {
  const phraseByIntent = Object.fromEntries(INTENTS.map((intent) => {
    const phrase = catalog.phrases.find((candidate) => candidate.intent === intent);
    if (phrase === undefined) throw new Error(`missing-practice-phrase:${intent}`);
    return [intent, phrase.text];
  })) as Record<PracticeIntent, string>;
  return {
    stage: "entry",
    scripted: true,
    catalogVersion: catalog.version,
    mirrorConfirmed: false,
    phraseEdited: false,
    safetyEnded: false,
    phraseByIntent
  };
}

export function completeMirror(state: SevenScreenPracticeState): SevenScreenPracticeState {
  requireStage(state, ["entry", "editable-phrase"]);
  return { ...state, mirrorConfirmed: true, stage: state.stage === "entry" ? "behavior" : state.stage };
}

export function startScenario(state: SevenScreenPracticeState): SevenScreenPracticeState {
  requireStage(state, ["entry"]);
  return { ...state, stage: "behavior" };
}

export function skipMirror(state: SevenScreenPracticeState): SevenScreenPracticeState {
  requireStage(state, ["entry", "editable-phrase"]);
  return state.stage === "entry" ? { ...state, stage: "behavior" } : state;
}

export function selectPracticeBehavior(
  state: SevenScreenPracticeState,
  behaviorId: string | null
): SevenScreenPracticeState {
  requireStage(state, ["behavior"]);
  return { ...state, behaviorId, stage: "need" };
}

export function selectPracticeNeed(
  state: SevenScreenPracticeState,
  intent: PracticeIntent
): SevenScreenPracticeState {
  requireStage(state, ["need"]);
  return {
    ...state,
    intent,
    phrase: state.phraseByIntent[intent],
    phraseEdited: false,
    stage: "editable-phrase"
  };
}

export function editPracticePhrase(
  state: SevenScreenPracticeState,
  phrase: string
): SevenScreenPracticeState {
  requireStage(state, ["editable-phrase"]);
  const trimmed = phrase.trim();
  if (trimmed.length === 0) throw new Error("practice-phrase-required");
  return { ...state, phrase: trimmed, phraseEdited: true };
}

export function showRespectfulResponse(
  state: SevenScreenPracticeState,
  catalog: JourneyPracticeCatalog
): SevenScreenPracticeState {
  requireStage(state, ["editable-phrase"]);
  if (state.intent === undefined || state.phrase === undefined) throw new Error("practice-need-required");
  const response = catalog.partnerResponses.find(({ intent }) => intent === state.intent);
  if (response === undefined) throw new Error(`missing-partner-response:${state.intent}`);
  return { ...state, partnerResponse: response.text, stage: "respectful-response" };
}

export function chooseAftercare(
  state: SevenScreenPracticeState,
  aftercareId: string
): SevenScreenPracticeState {
  requireStage(state, ["respectful-response"]);
  if (aftercareId.trim().length === 0) throw new Error("aftercare-required");
  return { ...state, aftercareId, stage: "optional-branch" };
}

export function chooseOptionalBranch(
  state: SevenScreenPracticeState,
  catalog: JourneyPracticeCatalog,
  branch: OptionalPracticeBranch
): SevenScreenPracticeState {
  requireStage(state, ["optional-branch", "optional-response"]);
  if (branch === "skip") return { ...state, stage: "completed" };
  const scenario = catalog.safetyBranches.find((candidate) => candidate.branch === branch);
  if (scenario === undefined) throw new Error(`missing-safety-branch:${branch}`);
  const resetState = { ...state };
  delete resetState.optionalUserResponse;
  return {
    ...resetState,
    optionalBranch: branch,
    optionalPartnerText: scenario.partnerText,
    optionalUserTexts: [...scenario.userTexts],
    optionalUserResponseEdited: false,
    optionalGuidance: scenario.guidance,
    safetyEnded: scenario.safeTerminal,
    stage: scenario.safeTerminal ? "safety-resources" : "optional-response"
  };
}

export function selectOptionalUserResponse(
  state: SevenScreenPracticeState,
  response: string
): SevenScreenPracticeState {
  requireStage(state, ["optional-response"]);
  if (!state.optionalUserTexts?.includes(response)) {
    throw new Error("unknown-optional-practice-response");
  }
  return { ...state, optionalUserResponse: response, optionalUserResponseEdited: false };
}

export function editOptionalUserResponse(
  state: SevenScreenPracticeState,
  response: string
): SevenScreenPracticeState {
  requireStage(state, ["optional-response"]);
  const trimmed = response.trim();
  if (trimmed.length === 0) throw new Error("optional-practice-response-required");
  return { ...state, optionalUserResponse: trimmed, optionalUserResponseEdited: true };
}

export function completePractice(state: SevenScreenPracticeState): SevenScreenPracticeState {
  if (state.stage === "safety-resources") throw new Error("safety-resources-must-close-explicitly");
  requireStage(state, ["completed", "optional-response"]);
  if (
    state.stage === "optional-response"
    && (state.optionalUserTexts?.length ?? 0) > 0
    && state.optionalUserResponse === undefined
  ) {
    throw new Error("optional-practice-response-required");
  }
  return {
    ...state,
    stage: "completed",
    pointEventKey: `practice:${state.catalogVersion}:first-completion`
  };
}

export function closeSafetyPractice(state: SevenScreenPracticeState): SevenScreenPracticeState {
  requireStage(state, ["safety-resources"]);
  return { ...state, stage: "completed" };
}

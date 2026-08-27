export type PracticeIntent =
  | "slow-down"
  | "adjust-touch"
  | "pause-and-decide"
  | "stop-current-action"
  | "choose-another-closeness"
  | "pause-to-feel";

export type PartnerResponseBranch =
  | "supportive"
  | "disappointed-follow-up"
  | "ignores-pause";

export type PresetPracticeState = {
  scenarioId: string;
  behaviorId: string;
  intent: PracticeIntent;
  phraseIds: string[];
  selectedPhraseId?: string;
  response?: {
    id: string;
    branch: PartnerResponseBranch;
    text: string;
    scripted: true;
    safeTerminal: boolean;
  };
  safetyEnded: boolean;
  catalogVersion: string;
  scripted: true;
};

export interface PresetPracticeEngine {
  start(input: { behaviorId: string; intent: PracticeIntent }): PresetPracticeState;
  selectPhrase(state: PresetPracticeState, phraseId: string): PresetPracticeState;
  choosePartnerResponse(
    state: PresetPracticeState,
    branch: PartnerResponseBranch
  ): PresetPracticeState;
}

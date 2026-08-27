import type { JourneyPracticeCatalog } from "@cave/content";

import type {
  PartnerResponseBranch,
  PracticeIntent,
  PresetPracticeEngine,
  PresetPracticeState
} from "./practice-types";

export class PresetPracticeError extends Error {
  constructor(readonly code: "behavior-required" | "unknown-phrase" | "unknown-branch") {
    super(code);
    this.name = "PresetPracticeError";
  }
}

export class LocalPresetPracticeEngine implements PresetPracticeEngine {
  constructor(private readonly catalog: JourneyPracticeCatalog) {}

  start({ behaviorId, intent }: { behaviorId: string; intent: PracticeIntent }): PresetPracticeState {
    if (behaviorId.trim().length === 0) throw new PresetPracticeError("behavior-required");
    return {
      scenarioId: `draft-scenario:${behaviorId}:${intent}`,
      behaviorId,
      intent,
      phraseIds: this.catalog.phrases
        .filter((phrase) => phrase.intent === intent)
        .sort((left, right) => left.order - right.order)
        .map(({ id }) => id),
      safetyEnded: false,
      catalogVersion: this.catalog.version,
      scripted: true
    };
  }

  selectPhrase(state: PresetPracticeState, phraseId: string): PresetPracticeState {
    if (!state.phraseIds.includes(phraseId)) throw new PresetPracticeError("unknown-phrase");
    return { ...state, selectedPhraseId: phraseId };
  }

  choosePartnerResponse(
    state: PresetPracticeState,
    branch: PartnerResponseBranch
  ): PresetPracticeState {
    const match = this.catalog.responses.find((response) => response.branch === branch);
    if (match === undefined) throw new PresetPracticeError("unknown-branch");
    return {
      ...state,
      response: {
        id: match.id,
        branch,
        text: match.text,
        scripted: true,
        safeTerminal: match.safeTerminal
      },
      safetyEnded: branch === "ignores-pause"
    };
  }
}

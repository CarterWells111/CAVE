import type { PartnerResponseBranch, PracticeIntent } from "../../src/features/journey/domain/practice-types";
import { loadJourneyContentCatalog } from "../../src/features/journey/infrastructure/journey-content-catalog";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { PresetPracticePage } from "../../src/features/journey/ui/pages/JourneyPages";

const PRACTICE_INTENTS = new Set<PracticeIntent>([
  "slow-down",
  "adjust-touch",
  "pause-and-decide",
  "stop-current-action",
  "choose-another-closeness",
  "pause-to-feel"
]);
const PARTNER_RESPONSE_BRANCHES = new Set<PartnerResponseBranch>([
  "supportive",
  "disappointed-follow-up",
  "ignores-pause"
]);

function isPracticeIntent(value: string): value is PracticeIntent {
  return PRACTICE_INTENTS.has(value as PracticeIntent);
}

function isPartnerResponseBranch(value: string): value is PartnerResponseBranch {
  return PARTNER_RESPONSE_BRANCHES.has(value as PartnerResponseBranch);
}

export default function PresetPracticeRoute() {
  const catalog = loadJourneyContentCatalog();
  const intents = catalog.practice.phrases
    .filter((option): option is typeof option & { intent: PracticeIntent } => isPracticeIntent(option.intent))
    .sort((left, right) => left.order - right.order);
  const branches = catalog.practice.responses
    .filter((option): option is typeof option & { branch: PartnerResponseBranch } => isPartnerResponseBranch(option.branch));
  return (
    <JourneyRouteScreen pageId="preset-practice">
      {({ controller, goTo, runAndRefresh, snapshot }) => {
        const initialIntent = intents.find(({ intent }) => intent === snapshot?.practice.intent)?.intent;
        const initialBranch = branches.find(({ branch }) => branch === snapshot?.practice.partnerResponseBranch)?.branch;
        return <PresetPracticePage
          behaviors={Object.keys(snapshot?.behaviorAttitudes ?? {}).map((id) => ({
            id,
            label: catalog.options.find((option) => option.id === id)?.label
              ?? snapshot?.customBehaviors.find((behavior) => behavior.id === id)?.label
              ?? "自定义行为"
          }))}
          branches={branches.map((response) => ({
            branch: response.branch,
            label: response.text
          }))}
          intents={intents.map((option) => ({
              intent: option.intent,
              label: option.text,
              phraseId: option.id,
              phrase: option.text
            }))}
          {...(snapshot?.practice.behaviorId === undefined ? {} : { initialBehaviorId: snapshot.practice.behaviorId })}
          {...(initialIntent === undefined ? {} : { initialIntent })}
          {...(initialBranch === undefined ? {} : { initialBranch })}
          {...(snapshot?.practice.editedPhrase === undefined ? {} : { initialEditedPhrase: snapshot.practice.editedPhrase })}
          onComplete={(input) => runAndRefresh(() => controller.completePractice(input))
            .then(() => goTo("final-preparation"))}
        />;
      }}
    </JourneyRouteScreen>
  );
}

import { loadJourneyContentCatalog } from "../../src/features/journey/infrastructure/journey-content-catalog";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { ReflectionPage } from "../../src/features/journey/ui/pages/reflection-page";

export default function ReflectionRoute() {
  const catalog = loadJourneyContentCatalog();
  const behaviorLabels = new Map(
    catalog.options
      .filter(({ group }) => group === "behavior")
      .map(({ id, label }) => [id, label]),
  );
  return (
    <JourneyRouteScreen pageId="reflection">
      {({ controller, goTo, runAndRefresh, snapshot }) => (
        <ReflectionPage
          behaviorAnswers={Object.entries(snapshot?.behaviorAttitudes ?? {}).map(([behaviorId, attitude]) => ({
            attitude,
            behaviorId,
            behaviorLabel: snapshot?.customBehaviors.find(({ id }) => id === behaviorId)?.label
              ?? behaviorLabels.get(behaviorId)
              ?? "已记录的行为",
          }))}
          initialValue={{
            comfortClarity: (snapshot?.reflection.comfortClarity ?? null) as "mostly-clear" | "need-space" | null,
            comfortNeedIds: snapshot?.comfortNeedIds ?? [],
            comfortNote: snapshot?.reflection.comfortNote ?? "",
            expressionDifficulty: (snapshot?.reflection.expressionDifficulty ?? null) as "can-say" | "needs-phrase" | "not-ready" | "unsure" | null,
            ...(snapshot?.journal.promptId ? { journalPromptId: snapshot.journal.promptId } : {}),
            journalSaveChoice: snapshot?.journalSaveChoice ?? "device",
            journalText: snapshot?.journal.text ?? "",
            motivationIds: snapshot?.motivationIds ?? [],
            pressureWithoutDisappointment: (snapshot?.reflection.pressureWithoutDisappointment ?? null) as "still-want" | "slow-down" | "unsure" | "less-want" | "skip" | null,
            refusalSafety: (snapshot?.reflection.refusalSafety ?? null) as "can" | "difficult-but-possible" | "fear-reaction" | "cannot-refuse" | "unsure" | null,
          }}
          onEditBehaviorAttitude={(behaviorId, attitude) => runAndRefresh(
            () => controller.setBehaviorAttitude(behaviorId, attitude),
          )}
          onComplete={(input) => runAndRefresh(() => controller.saveReflection({
            comfortClarity: input.comfortClarity,
            comfortNeedIds: input.comfortNeedIds,
            comfortNote: input.comfortNote,
            expressionDifficulty: input.expressionDifficulty,
            expressionSupportNeeded: input.expressionDifficulty === null
              ? null
              : input.expressionDifficulty === "needs-phrase",
            ...(input.journalPromptId ? { journalPromptId: input.journalPromptId } : {}),
            journalSaveChoice: input.journalSaveChoice,
            journalText: input.journalText,
            motivationIds: input.motivationIds,
            pressureWithoutDisappointment: input.pressureWithoutDisappointment,
            refusalSafety: input.refusalSafety,
          }))
            .then(() => goTo("preset-practice"))}
        />
      )}
    </JourneyRouteScreen>
  );
}

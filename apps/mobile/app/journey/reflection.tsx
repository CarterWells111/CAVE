import { useEffect, useState } from "react";

import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { ReflectionPage, type ReflectionValue } from "../../src/features/journey/ui/pages/reflection-page";

export default function ReflectionRoute() {
  const runtime = useJourneyRuntime();
  const [cardOpen, setCardOpen] = useState(false);
  const [showLocalJournalSaveNotice, setShowLocalJournalSaveNotice] = useState(true);

  useEffect(() => {
    let active = true;
    void runtime.privacySettings.getPrivacySettings().then(
      (settings) => {
        if (active) setShowLocalJournalSaveNotice(settings.showLocalJournalSaveNotice);
      },
      () => {
        if (active) setShowLocalJournalSaveNotice(true);
      },
    );
    return () => { active = false; };
  }, [runtime.privacySettings]);

  const setJournalSaveNotice = async (enabled: boolean) => {
    const current = await runtime.privacySettings.getPrivacySettings();
    await runtime.privacySettings.setPrivacySettings({ ...current, showLocalJournalSaveNotice: enabled });
    setShowLocalJournalSaveNotice(enabled);
  };

  return (
    <JourneyRouteScreen immersiveContent={cardOpen} pageId="reflection">
      {({ controller, goTo, runAndRefresh, snapshot }) => (
        <ReflectionPage
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
          onCardVisibilityChange={setCardOpen}
          onSetJournalSaveNotice={setJournalSaveNotice}
          onSave={(input) => runAndRefresh(() => saveReflection(controller, input))}
          onComplete={(input) => runAndRefresh(() => saveReflection(controller, input))
            .then(() => goTo("preset-practice"))}
          showLocalJournalSaveNotice={showLocalJournalSaveNotice}
        />
      )}
    </JourneyRouteScreen>
  );
}

function saveReflection(
  controller: ReturnType<typeof useJourneyRuntime>["controller"],
  input: ReflectionValue,
) {
  return controller.saveReflection({
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
  });
}

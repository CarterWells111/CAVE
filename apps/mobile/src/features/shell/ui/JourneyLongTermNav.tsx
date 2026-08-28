import { useRouter } from "expo-router";
import { useEffect, useState } from "react";

import {
  type JourneyRuntimeContextValue,
  useOptionalJourneyRuntime
} from "../../journey/runtime/JourneyRuntimeProvider";
import { LongTermBottomNav, type LongTermTab } from "./LongTermBottomNav";
import { getLongTermDestination } from "./long-term-navigation";

export type JourneyLongTermNavProps = Readonly<{
  activeTab?: LongTermTab | undefined;
}>;

export function JourneyLongTermNav({ activeTab }: JourneyLongTermNavProps) {
  const runtime = useOptionalJourneyRuntime();
  if (runtime === null) return null;

  return (
    <AuthorizedJourneyLongTermNav
      activeTab={activeTab}
      shellState={runtime.shellState}
      snapshot={runtime.snapshot}
    />
  );
}

function AuthorizedJourneyLongTermNav({
  activeTab,
  shellState,
  snapshot,
}: JourneyLongTermNavProps & Pick<JourneyRuntimeContextValue, "shellState" | "snapshot">) {
  const router = useRouter();
  const [completionConfirmed, setCompletionConfirmed] = useState(false);

  useEffect(() => {
    let active = true;
    setCompletionConfirmed(false);
    void shellState.load().then(
      (completion) => {
        if (active) setCompletionConfirmed(completion !== null);
      },
      () => {
        if (active) setCompletionConfirmed(false);
      }
    );
    return () => {
      active = false;
    };
  }, [shellState]);

  if (snapshot?.ageConfirmed !== true && !completionConfirmed) return null;

  return (
    <LongTermBottomNav
      activeTab={activeTab}
      navigate={(tab) => router.replace(getLongTermDestination(tab).path)}
    />
  );
}

import { useRouter } from "expo-router";
import { useEffect, useState } from "react";

import { useJourneyRuntime } from "../../journey/runtime/JourneyRuntimeProvider";
import { LongTermBottomNav, type LongTermTab } from "./LongTermBottomNav";

export type JourneyLongTermNavProps = Readonly<{
  activeTab?: LongTermTab | undefined;
}>;

const paths = {
  home: "/(tabs)",
  reviews: "/(tabs)/reviews",
  practice: "/(tabs)/practice",
  cards: "/(tabs)/cards"
} as const;

export function JourneyLongTermNav({ activeTab }: JourneyLongTermNavProps) {
  const router = useRouter();
  const { shellState } = useJourneyRuntime();
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

  if (!completionConfirmed) return null;

  return <LongTermBottomNav activeTab={activeTab} navigate={(tab) => router.replace(paths[tab])} />;
}

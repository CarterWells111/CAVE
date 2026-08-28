import { useRouter } from "expo-router";

import { LongTermBottomNav, type LongTermTab } from "./LongTermBottomNav";
import { getLongTermDestination } from "./long-term-navigation";

export type JourneyLongTermNavProps = Readonly<{
  activeTab?: LongTermTab | undefined;
}>;

export function JourneyLongTermNav({ activeTab }: JourneyLongTermNavProps) {
  const router = useRouter();

  return (
    <LongTermBottomNav
      activeTab={activeTab}
      navigate={(tab) => router.replace(getLongTermDestination(tab).path)}
    />
  );
}

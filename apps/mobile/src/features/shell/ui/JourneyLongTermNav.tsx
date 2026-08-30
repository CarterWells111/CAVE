import { useRouter } from "expo-router";

import { LongTermBottomNav, type LongTermTab } from "./LongTermBottomNav";
import { getLongTermDestination, MAIN_TAB_DESTINATIONS } from "./long-term-navigation";

export type JourneyLongTermNavProps = Readonly<{
  activeTab?: LongTermTab | undefined;
  disabled?: boolean | undefined;
}>;

export function JourneyLongTermNav({ activeTab, disabled = false }: JourneyLongTermNavProps) {
  const router = useRouter();

  return (
    <LongTermBottomNav
      activeTab={activeTab}
      destinations={MAIN_TAB_DESTINATIONS}
      disabled={disabled}
      navigate={(tab) => { if (!disabled) router.replace(getLongTermDestination(tab).path); }}
    />
  );
}

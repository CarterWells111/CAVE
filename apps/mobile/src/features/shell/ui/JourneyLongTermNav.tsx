import { useRouter } from "expo-router";

import { LongTermBottomNav, type LongTermTab } from "./LongTermBottomNav";
import { getLongTermDestination } from "./long-term-navigation";

export type JourneyLongTermNavProps = Readonly<{
  activeTab?: LongTermTab | undefined;
  disabled?: boolean | undefined;
}>;

export function JourneyLongTermNav({ activeTab, disabled = false }: JourneyLongTermNavProps) {
  const router = useRouter();

  return (
    <LongTermBottomNav
      activeTab={activeTab}
      disabled={disabled}
      navigate={(tab) => { if (!disabled) router.replace(getLongTermDestination(tab).path); }}
    />
  );
}

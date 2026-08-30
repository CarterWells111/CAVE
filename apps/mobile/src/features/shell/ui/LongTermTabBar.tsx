import { LongTermBottomNav } from "./LongTermBottomNav";
import {
  getLongTermDestination,
  getLongTermDestinationByRouteName,
  MAIN_TAB_DESTINATIONS,
  type LongTermRouteName,
} from "./long-term-navigation";

type LongTermTabBarRoute = Readonly<{
  key: string;
  name: string;
}>;

export type LongTermTabBarProps = Readonly<{
  emitTabPress: (target: string) => Readonly<{ defaultPrevented: boolean }>;
  navigate: (routeName: LongTermRouteName) => void;
  state: Readonly<{
    index: number;
    routes: ReadonlyArray<LongTermTabBarRoute>;
  }>;
}>;

export function LongTermTabBar({ emitTabPress, navigate, state }: LongTermTabBarProps) {
  const activeTab = getLongTermDestinationByRouteName(state.routes[state.index]?.name ?? "")?.tab;

  return (
    <LongTermBottomNav
      activeTab={activeTab}
      destinations={MAIN_TAB_DESTINATIONS}
      navigate={(tab) => {
        const destination = getLongTermDestination(tab);
        const routeIndex = state.routes.findIndex((route) => route.name === destination.routeName);
        if (routeIndex < 0) return;

        const route = state.routes[routeIndex];
        if (route === undefined) return;

        const event = emitTabPress(route.key);
        if (routeIndex !== state.index && !event.defaultPrevented) navigate(destination.routeName);
      }}
    />
  );
}

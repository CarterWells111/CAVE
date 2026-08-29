import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from "react";
import {
  AccessibilityInfo,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import { space } from "../../../core/design/tokens";
import { Screen, type ScreenProps } from "../../../core/ui/Screen";
import {
  createGuidedScrollCoordinator,
  type GuidedScrollContainer,
  type GuidedScrollCoordinator,
  type GuidedScrollMode,
  type GuidedScrollNode,
} from "./guided-scroll";

type GuidedScrollContextValue = {
  registerTarget(id: string, node: GuidedScrollNode | null): void;
  reveal(id: string, options?: { mode?: GuidedScrollMode }): void;
};

const noopContext: GuidedScrollContextValue = {
  registerTarget: () => undefined,
  reveal: () => undefined,
};

const GuidedScrollContext = createContext<GuidedScrollContextValue>(noopContext);

export type JourneyGuidedScrollScreenProps = ScreenProps & {
  resetKey?: string | undefined;
};

export function JourneyGuidedScrollScreen({
  children,
  onScroll,
  onScrollBeginDrag,
  resetKey,
  scrollEventThrottle,
  ...screenProps
}: JourneyGuidedScrollScreenProps) {
  const scrollRef = useRef<ScrollView>(null);
  const currentOffsetRef = useRef(0);
  const reducedMotionRef = useRef(false);
  const targetsRef = useRef(new Map<string, GuidedScrollNode>());
  const coordinatorRef = useRef<GuidedScrollCoordinator | null>(null);

  if (coordinatorRef.current === null) {
    coordinatorRef.current = createGuidedScrollCoordinator({
      gap: space.md,
      getCurrentOffset: () => currentOffsetRef.current,
      getReducedMotion: () => reducedMotionRef.current,
      getScrollNode: () => scrollRef.current as GuidedScrollContainer | null,
      getTarget: (id) => targetsRef.current.get(id) ?? null,
      schedule: (callback) => {
        requestAnimationFrame(() => requestAnimationFrame(callback));
      },
    });
  }

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) reducedMotionRef.current = enabled;
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      reducedMotionRef.current = enabled;
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    coordinatorRef.current?.cancel();
  }, [resetKey]);

  useEffect(() => () => {
    coordinatorRef.current?.dispose();
    targetsRef.current.clear();
  }, []);

  const contextValue = useMemo<GuidedScrollContextValue>(() => ({
    registerTarget(id, node) {
      if (node === null) targetsRef.current.delete(id);
      else targetsRef.current.set(id, node);
    },
    reveal(id, options) {
      coordinatorRef.current?.reveal(id, options);
    },
  }), []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    currentOffsetRef.current = event.nativeEvent.contentOffset.y;
    onScroll?.(event);
  }, [onScroll]);

  const handleScrollBeginDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    coordinatorRef.current?.cancel();
    onScrollBeginDrag?.(event);
  }, [onScrollBeginDrag]);

  return (
    <GuidedScrollContext.Provider value={contextValue}>
      <Screen
        {...screenProps}
        ref={scrollRef}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        scrollEventThrottle={scrollEventThrottle ?? 16}
      >
        {children}
      </Screen>
    </GuidedScrollContext.Provider>
  );
}

export function JourneyScrollTarget({
  children,
  targetId,
}: PropsWithChildren<{ targetId: string }>) {
  const { registerTarget } = use(GuidedScrollContext);
  const currentNodeRef = useRef<GuidedScrollNode | null>(null);
  const setNode = useCallback((node: View | null) => {
    if (currentNodeRef.current !== null) registerTarget(targetId, null);
    currentNodeRef.current = node;
    if (node !== null) registerTarget(targetId, node);
  }, [registerTarget, targetId]);

  useEffect(() => () => registerTarget(targetId, null), [registerTarget, targetId]);

  return (
    <View
      collapsable={false}
      ref={setNode}
      testID={`journey-scroll-target-${targetId}`}
    >
      {children}
    </View>
  );
}

export function useJourneyGuidedScroll(): Pick<GuidedScrollContextValue, "reveal"> {
  const { reveal } = use(GuidedScrollContext);
  return { reveal };
}

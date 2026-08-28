import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { AccessibilityInfo } from "react-native";

const ReducedMotionContext = createContext(false);

export function MotionPreferencesProvider({ children }: PropsWithChildren) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (enabled) => { if (active) setReducedMotion(enabled); },
      () => { if (active) setReducedMotion(false); },
    );
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      if (active) setReducedMotion(enabled);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return <ReducedMotionContext.Provider value={reducedMotion}>{children}</ReducedMotionContext.Provider>;
}

export function useReducedMotion() {
  return useContext(ReducedMotionContext);
}

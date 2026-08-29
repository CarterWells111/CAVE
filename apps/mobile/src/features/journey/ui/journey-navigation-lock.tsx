import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";

type JourneyNavigationLock = Readonly<{
  locked: boolean;
  setLocked(locked: boolean): void;
}>;

const fallbackLock: JourneyNavigationLock = Object.freeze({
  locked: false,
  setLocked: () => undefined,
});

const JourneyNavigationLockContext = createContext<JourneyNavigationLock>(fallbackLock);

export function JourneyNavigationLockProvider({ children }: PropsWithChildren) {
  const [locked, setLocked] = useState(false);
  const value = useMemo(() => ({ locked, setLocked }), [locked]);
  return (
    <JourneyNavigationLockContext.Provider value={value}>
      {children}
    </JourneyNavigationLockContext.Provider>
  );
}

export function useJourneyNavigationLock(): JourneyNavigationLock {
  return useContext(JourneyNavigationLockContext);
}

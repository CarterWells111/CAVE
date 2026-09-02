import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from "react";

export type JourneyStepBackRegistration = Readonly<{
  active: boolean;
  disabled: boolean;
  onBack: () => void | Promise<void>;
}>;

type RegistrationSetter = Dispatch<SetStateAction<JourneyStepBackRegistration | null>>;

const JourneyStepBackContext = createContext<RegistrationSetter | null>(null);

export function JourneyStepBackProvider({
  children,
  setRegistration,
}: PropsWithChildren<{ setRegistration: RegistrationSetter }>) {
  return (
    <JourneyStepBackContext.Provider value={setRegistration}>
      {children}
    </JourneyStepBackContext.Provider>
  );
}

export function useJourneyStepBack(registration: JourneyStepBackRegistration) {
  const setRegistration = useContext(JourneyStepBackContext);
  const onBackRef = useRef(registration.onBack);
  onBackRef.current = registration.onBack;

  useEffect(() => {
    if (setRegistration === null) return;
    const currentRegistration: JourneyStepBackRegistration = {
      active: registration.active,
      disabled: registration.disabled,
      onBack: () => onBackRef.current(),
    };
    setRegistration(currentRegistration);
    return () => {
      setRegistration((current) => current === currentRegistration ? null : current);
    };
  }, [registration.active, registration.disabled, setRegistration]);
}

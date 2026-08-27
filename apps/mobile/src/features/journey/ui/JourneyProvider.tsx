import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Pressable, Text, View } from "react-native";

import type {
  JourneyApplicationService,
  JourneyRecoveryState
} from "../application/journey-application-service";
import type { JourneyDraft } from "../domain/types";

type InitializableJourneyService = JourneyApplicationService & {
  initialize(): Promise<JourneyRecoveryState>;
};

type JourneyContextValue = {
  service: InitializableJourneyService;
  snapshot: JourneyDraft | null;
  refresh(): void;
  runAndRefresh<T>(action: () => Promise<T>): Promise<T>;
};

type JourneyProviderState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "recovery-required" }
  | {
    status: "error";
    code: "journey-runtime-initialization-failed" | "journey-runtime-reset-failed";
  };

const JourneyContext = createContext<JourneyContextValue | null>(null);

export function JourneyProvider({
  service,
  children
}: PropsWithChildren<{ service: InitializableJourneyService }>) {
  const [state, setState] = useState<JourneyProviderState>({ status: "loading" });
  const [snapshot, setSnapshot] = useState<JourneyDraft | null>(null);
  const initializationAttempt = useRef(0);
  const serviceGeneration = useRef(0);

  const refresh = useCallback(() => setSnapshot(service.getSnapshot()), [service]);
  const runAndRefresh = useCallback(async <T,>(action: () => Promise<T>) => {
    const generation = serviceGeneration.current;
    try {
      return await action();
    } finally {
      if (generation === serviceGeneration.current) refresh();
    }
  }, [refresh]);

  useLayoutEffect(() => (
    () => { serviceGeneration.current += 1; }
  ), [service]);

  const finishInitialization = useCallback(async (
    currentService: InitializableJourneyService,
    attempt: number
  ) => {
    try {
      const recovery = await currentService.initialize();
      if (attempt !== initializationAttempt.current) return;
      setSnapshot(currentService.getSnapshot());
      setState({ status: recovery === "ready" ? "ready" : "recovery-required" });
    } catch {
      if (attempt !== initializationAttempt.current) return;
      setState({ status: "error", code: "journey-runtime-initialization-failed" });
    }
  }, []);

  const initialize = useCallback(async () => {
    const attempt = ++initializationAttempt.current;
    setState({ status: "loading" });
    await finishInitialization(service, attempt);
  }, [finishInitialization, service]);

  const resetAndInitialize = useCallback(async () => {
    const attempt = ++initializationAttempt.current;
    setState({ status: "loading" });
    try {
      await service.resetJourney();
    } catch {
      if (attempt === initializationAttempt.current) {
        setState({ status: "error", code: "journey-runtime-reset-failed" });
      }
      return;
    }
    await finishInitialization(service, attempt);
  }, [finishInitialization, service]);

  useEffect(() => {
    void initialize();
    return () => { initializationAttempt.current += 1; };
  }, [initialize]);

  const context = useMemo(
    () => ({ service, snapshot, refresh, runAndRefresh }),
    [refresh, runAndRefresh, service, snapshot]
  );

  if (state.status === "loading") {
    return <Text accessibilityLiveRegion="polite">正在恢复本机旅程…</Text>;
  }
  if (state.status === "error") {
    return (
      <View>
        <Text accessibilityLiveRegion="assertive" accessibilityRole="alert">无法读取本机旅程</Text>
        <Text>错误代码：{state.code}</Text>
        <Pressable accessibilityRole="button" onPress={() => { void initialize(); }}>
          <Text>重试</Text>
        </Pressable>
      </View>
    );
  }
  if (state.status === "recovery-required") {
    return (
      <View>
        <Text accessibilityLiveRegion="assertive" accessibilityRole="alert">本机旅程需要恢复</Text>
        <Pressable accessibilityRole="button" onPress={() => { void resetAndInitialize(); }}>
          <Text>重置本机旅程</Text>
        </Pressable>
      </View>
    );
  }
  return <JourneyContext.Provider value={context}>{children}</JourneyContext.Provider>;
}

export function useJourney() {
  const context = useContext(JourneyContext);
  if (context === null) throw new Error("JourneyProvider is required");
  return context;
}

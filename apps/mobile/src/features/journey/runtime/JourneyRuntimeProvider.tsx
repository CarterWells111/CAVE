import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Text, View } from "react-native";

import { JourneyProvider, useJourney } from "../ui/JourneyProvider";
import type { JourneyDraft } from "../domain/types";
import type { JourneyRuntime, JourneyRuntimeMode } from "./journey-runtime";

export type JourneyRuntimeContextValue = {
  mode: JourneyRuntimeMode;
  snapshot: JourneyDraft | null;
  controller: JourneyRuntime["controller"];
  cards: JourneyRuntime["cards"];
  drafts: JourneyRuntime["drafts"];
  service: JourneyRuntime["service"];
  shellState: JourneyRuntime["shellState"];
  reviewHistory: JourneyRuntime["reviewHistory"];
  deleteAllData(): Promise<void>;
  runAndRefresh<T>(action: () => Promise<T>): Promise<T>;
  restart(): Promise<void>;
  replaceActiveReview(): Promise<void>;
};

type JourneyRuntimeProviderProps = PropsWithChildren<{
  createRuntime(): Promise<JourneyRuntime>;
}>;

type RuntimeState =
  | { status: "loading" }
  | { status: "ready"; runtime: JourneyRuntime }
  | { status: "error"; code: "journey-runtime-creation-failed" };

const JourneyRuntimeContext = createContext<JourneyRuntimeContextValue | null>(null);

function RuntimeContextProvider({
  children,
  runtime
}: PropsWithChildren<{ runtime: JourneyRuntime }>) {
  const { runAndRefresh, snapshot } = useJourney();
  const restart = useCallback(
    () => runAndRefresh(() => runtime.service.resetJourney()),
    [runAndRefresh, runtime]
  );
  const deleteAllData = useCallback(
    () => runAndRefresh(() => runtime.deleteAllData()),
    [runAndRefresh, runtime]
  );
  const replaceActiveReview = useCallback(
    () => runAndRefresh(() => runtime.replaceActiveReview()),
    [runAndRefresh, runtime]
  );
  const context = useMemo<JourneyRuntimeContextValue>(() => ({
    mode: runtime.mode,
    snapshot,
    controller: runtime.controller,
    cards: runtime.cards,
    drafts: runtime.drafts,
    service: runtime.service,
    shellState: runtime.shellState,
    reviewHistory: runtime.reviewHistory,
    deleteAllData,
    runAndRefresh,
    restart,
    replaceActiveReview
  }), [deleteAllData, replaceActiveReview, restart, runAndRefresh, runtime, snapshot]);

  return (
    <JourneyRuntimeContext.Provider value={context}>
      {runtime.mode === "expo-go-demo"
        ? <Text>Expo Go 演示模式，数据仅在本次打开期间暂存</Text>
        : null}
      {children}
    </JourneyRuntimeContext.Provider>
  );
}

export function JourneyRuntimeProvider({
  children,
  createRuntime
}: JourneyRuntimeProviderProps) {
  const [state, setState] = useState<RuntimeState>({ status: "loading" });
  const createRuntimeRef = useRef(createRuntime);
  const runtimePromiseRef = useRef<Promise<JourneyRuntime> | null>(null);

  useEffect(() => {
    runtimePromiseRef.current ??= Promise.resolve().then(createRuntimeRef.current);
    const runtimePromise = runtimePromiseRef.current;
    let active = true;

    void runtimePromise.then(
      (runtime) => {
        if (active) setState({ status: "ready", runtime });
      },
      () => {
        if (active) setState({ status: "error", code: "journey-runtime-creation-failed" });
      }
    );

    return () => { active = false; };
  }, []);

  if (state.status === "loading") {
    return <Text accessibilityLiveRegion="polite">正在启动旅程运行时…</Text>;
  }
  if (state.status === "error") {
    return (
      <View accessibilityRole="alert">
        <Text>无法启动旅程运行时</Text>
        <Text>错误代码：{state.code}</Text>
      </View>
    );
  }

  return (
    <JourneyProvider service={state.runtime.service}>
      <RuntimeContextProvider runtime={state.runtime}>
        {children}
      </RuntimeContextProvider>
    </JourneyProvider>
  );
}

export function useJourneyRuntime() {
  const context = useContext(JourneyRuntimeContext);
  if (context === null) throw new Error("JourneyRuntimeProvider is required");
  return context;
}

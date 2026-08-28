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
  branchFromReview: JourneyRuntime["branchFromReview"];
};

export type AdultDeclarationContextValue = {
  status: "public" | "authorized";
  confirmAdult(): Promise<void>;
};

type JourneyRuntimeProviderProps = PropsWithChildren<{
  createRuntime(): Promise<JourneyRuntime>;
}>;

type RuntimeState =
  | { status: "loading" }
  | { status: "public"; runtime: JourneyRuntime }
  | { status: "authorized"; runtime: JourneyRuntime }
  | { status: "error"; code: "journey-runtime-creation-failed" };

const JourneyRuntimeContext = createContext<JourneyRuntimeContextValue | null>(null);
const AdultDeclarationContext = createContext<AdultDeclarationContextValue | null>(null);

function RuntimeContextProvider({
  children,
  runtime,
  refreshAuthorization
}: PropsWithChildren<{
  runtime: JourneyRuntime;
  refreshAuthorization(): Promise<void>;
}>) {
  const { runAndRefresh, snapshot } = useJourney();
  const restart = useCallback(
    () => runAndRefresh(async () => {
      await runtime.service.resetJourney();
      await runtime.adultDeclaration.deleteAdultDeclaration();
      await refreshAuthorization();
    }),
    [refreshAuthorization, runAndRefresh, runtime]
  );
  const deleteAllData = useCallback(
    () => runAndRefresh(async () => {
      await runtime.deleteAllData();
      await refreshAuthorization();
    }),
    [refreshAuthorization, runAndRefresh, runtime]
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
    replaceActiveReview,
    branchFromReview: runtime.branchFromReview
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
  const adultConfirmationRef = useRef<Promise<void> | null>(null);

  const setAuthorizationFromMarker = useCallback(async (runtime: JourneyRuntime) => {
    const declared = await runtime.adultDeclaration.hasAdultDeclaration();
    setState({ status: declared ? "authorized" : "public", runtime });
  }, []);

  useEffect(() => {
    runtimePromiseRef.current ??= Promise.resolve().then(createRuntimeRef.current);
    const runtimePromise = runtimePromiseRef.current;
    let active = true;

    void runtimePromise.then(async (runtime) => {
      const declared = await runtime.adultDeclaration.hasAdultDeclaration();
      if (active) setState({ status: declared ? "authorized" : "public", runtime });
    }).catch(
      () => {
        if (active) setState({ status: "error", code: "journey-runtime-creation-failed" });
      }
    );

    return () => { active = false; };
  }, []);

  const confirmAdult = useCallback(() => {
    if (state.status !== "public" && state.status !== "authorized") {
      return Promise.reject(new Error("journey-runtime-not-ready"));
    }
    if (
      state.status === "authorized"
      && state.runtime.service.getSnapshot()?.ageConfirmed === true
    ) return Promise.resolve();
    if (adultConfirmationRef.current !== null) return adultConfirmationRef.current;

    const runtime = state.runtime;
    const confirmation = (async () => {
      if (state.status === "public") {
        const recoveryState = await runtime.service.initialize();
        if (recoveryState !== "ready") throw new Error("journey-recovery-required");
      }
      await runtime.service.confirmAdult();
      await runtime.adultDeclaration.recordAdultDeclaration();
      if (state.status === "public") setState({ status: "authorized", runtime });
    })();
    adultConfirmationRef.current = confirmation;
    void confirmation.finally(() => {
      if (adultConfirmationRef.current === confirmation) adultConfirmationRef.current = null;
    }).catch(() => undefined);
    return confirmation;
  }, [state]);

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

  const adultDeclaration = { status: state.status, confirmAdult } satisfies AdultDeclarationContextValue;
  if (state.status === "public") {
    return (
      <AdultDeclarationContext.Provider value={adultDeclaration}>
        {state.runtime.mode === "expo-go-demo"
          ? <Text>Expo Go 演示模式，数据仅在本次打开期间暂存</Text>
          : null}
        {children}
      </AdultDeclarationContext.Provider>
    );
  }

  return (
    <AdultDeclarationContext.Provider value={adultDeclaration}>
      <JourneyProvider service={state.runtime.service}>
        <RuntimeContextProvider
          refreshAuthorization={() => setAuthorizationFromMarker(state.runtime)}
          runtime={state.runtime}
        >
          {children}
        </RuntimeContextProvider>
      </JourneyProvider>
    </AdultDeclarationContext.Provider>
  );
}

export function useAdultDeclaration() {
  const context = useContext(AdultDeclarationContext);
  if (context === null) throw new Error("JourneyRuntimeProvider is required");
  return context;
}

export function useOptionalJourneyRuntime() {
  return useContext(JourneyRuntimeContext);
}

export function useJourneyRuntime() {
  const context = useContext(JourneyRuntimeContext);
  if (context === null) throw new Error("JourneyRuntimeProvider is required");
  return context;
}

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
import { Text, View } from "react-native";

import type {
  JourneyApplicationService,
  JourneyRecoveryState
} from "../application/journey-application-service";
import type { JourneyDraft } from "../domain/types";
import { JourneyAction } from "./components/JourneyAction";
import { JourneyStatusBanner } from "./components/JourneyStatusBanner";

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
  const mountedRef = useRef(false);
  const currentServiceRef = useRef(service);
  const requestGenerationRef = useRef(0);
  const serviceGenerationRef = useRef(0);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestGenerationRef.current += 1;
      serviceGenerationRef.current += 1;
    };
  }, []);

  useLayoutEffect(() => {
    if (currentServiceRef.current === service) return;
    currentServiceRef.current = service;
    requestGenerationRef.current += 1;
    serviceGenerationRef.current += 1;
  }, [service]);

  const isCurrentRequest = useCallback((
    requestService: InitializableJourneyService,
    requestGeneration: number
  ) => (
    mountedRef.current
    && currentServiceRef.current === requestService
    && requestGenerationRef.current === requestGeneration
  ), []);

  const refresh = useCallback(() => {
    if (!mountedRef.current || currentServiceRef.current !== service) return;
    setSnapshot(service.getSnapshot());
  }, [service]);

  const runAndRefresh = useCallback(async <T,>(action: () => Promise<T>) => {
    const actionService = service;
    const serviceGeneration = serviceGenerationRef.current;
    try {
      return await action();
    } finally {
      if (
        mountedRef.current
        && currentServiceRef.current === actionService
        && serviceGenerationRef.current === serviceGeneration
      ) {
        setSnapshot(actionService.getSnapshot());
      }
    }
  }, [service]);

  const initialize = useCallback(async (showLoading = true) => {
    const requestService = service;
    const requestGeneration = requestGenerationRef.current + 1;
    requestGenerationRef.current = requestGeneration;

    if (showLoading && isCurrentRequest(requestService, requestGeneration)) {
      setState({ status: "loading" });
    }
    try {
      const recovery = await requestService.initialize();
      if (!isCurrentRequest(requestService, requestGeneration)) return;
      const nextSnapshot = requestService.getSnapshot();
      if (!isCurrentRequest(requestService, requestGeneration)) return;
      setSnapshot(nextSnapshot);
      setState({ status: recovery === "ready" ? "ready" : "recovery-required" });
    } catch {
      if (isCurrentRequest(requestService, requestGeneration)) {
        setState({ status: "error", code: "journey-runtime-initialization-failed" });
      }
    }
  }, [isCurrentRequest, service]);

  const reset = useCallback(async () => {
    const requestService = service;
    const requestGeneration = requestGenerationRef.current + 1;
    requestGenerationRef.current = requestGeneration;

    try {
      await requestService.resetJourney();
    } catch (error) {
      if (!isCurrentRequest(requestService, requestGeneration)) return;
      setState({ status: "error", code: "journey-runtime-reset-failed" });
      throw error;
    }
    if (!isCurrentRequest(requestService, requestGeneration)) return;
    await initialize(false);
  }, [initialize, isCurrentRequest, service]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const context = useMemo(
    () => ({ service, snapshot, refresh, runAndRefresh }),
    [refresh, runAndRefresh, service, snapshot]
  );

  if (state.status === "loading") {
    return <JourneyStatusBanner message="正在恢复本机旅程…" role="status" />;
  }
  if (state.status === "error") {
    const resetFailed = state.code === "journey-runtime-reset-failed";
    return (
      <View>
        <Text>{resetFailed ? "本机旅程需要恢复" : "无法读取本机旅程"}</Text>
        <JourneyStatusBanner
          message={resetFailed ? "重置失败，请重试。" : "读取失败，请重试。"}
          role="alert"
          tone="error"
        />
        <Text>{`错误代码：${state.code}`}</Text>
        <JourneyAction
          errorMessage={resetFailed ? "重置失败，请重试。" : "重试失败，请重试。"}
          label={resetFailed ? "重置本机旅程" : "重试"}
          loadingLabel={resetFailed ? "正在重置…" : "正在重试…"}
          onAction={resetFailed ? reset : () => initialize(false)}
        />
      </View>
    );
  }
  if (state.status === "recovery-required") {
    return (
      <View>
        <JourneyStatusBanner message="本机旅程需要恢复" role="alert" tone="error" />
        <JourneyAction
          errorMessage="重置失败，请重试。"
          label="重置本机旅程"
          loadingLabel="正在重置…"
          onAction={reset}
        />
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

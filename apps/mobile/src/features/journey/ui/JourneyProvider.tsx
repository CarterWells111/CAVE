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
};

const JourneyContext = createContext<JourneyContextValue | null>(null);

export function JourneyProvider({
  service,
  children
}: PropsWithChildren<{ service: InitializableJourneyService }>) {
  const [state, setState] = useState<"loading" | "ready" | "error" | "recovery-required">("loading");
  const [snapshot, setSnapshot] = useState<JourneyDraft | null>(null);
  const mountedRef = useRef(false);
  const currentServiceRef = useRef(service);
  const requestGenerationRef = useRef(0);

  useLayoutEffect(() => {
    if (currentServiceRef.current === service) return;
    currentServiceRef.current = service;
    requestGenerationRef.current += 1;
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

  const initialize = useCallback(async (showLoading = true) => {
    const requestService = service;
    const requestGeneration = requestGenerationRef.current + 1;
    requestGenerationRef.current = requestGeneration;

    if (showLoading && isCurrentRequest(requestService, requestGeneration)) {
      setState("loading");
    }
    try {
      const recovery = await requestService.initialize();
      if (!isCurrentRequest(requestService, requestGeneration)) return;
      const nextSnapshot = requestService.getSnapshot();
      if (!isCurrentRequest(requestService, requestGeneration)) return;
      setSnapshot(nextSnapshot);
      setState(recovery === "ready" ? "ready" : "recovery-required");
    } catch {
      if (isCurrentRequest(requestService, requestGeneration)) setState("error");
    }
  }, [isCurrentRequest, service]);

  const reset = useCallback(async () => {
    const requestService = service;
    const requestGeneration = requestGenerationRef.current + 1;
    requestGenerationRef.current = requestGeneration;

    await requestService.resetJourney();
    if (!isCurrentRequest(requestService, requestGeneration)) return;
    await initialize(false);
  }, [initialize, isCurrentRequest, service]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestGenerationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const context = useMemo(() => ({ service, snapshot, refresh }), [refresh, service, snapshot]);

  if (state === "loading") {
    return <JourneyStatusBanner message="正在恢复本机旅程…" role="status" />;
  }
  if (state === "error") {
    return (
      <View>
        <Text>无法读取本机旅程</Text>
        <JourneyStatusBanner message="读取失败，请重试。" role="status" tone="error" />
        <JourneyAction
          errorMessage="重试失败，请重试。"
          label="重试"
          loadingLabel="正在重试…"
          onAction={() => initialize(false)}
        />
      </View>
    );
  }
  if (state === "recovery-required") {
    return (
      <View>
        <Text>本机旅程需要恢复</Text>
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

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

import { theme } from "../../../core/design/theme";
import { Button } from "../../../core/ui/Button";
import { ErrorState } from "../../../core/ui/ErrorState";
import { StatusBanner } from "../../../core/ui/StatusBanner";
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

type PendingRecoveryAction = "retry" | "reset";

const JourneyContext = createContext<JourneyContextValue | null>(null);

export function JourneyProvider({
  service,
  children
}: PropsWithChildren<{ service: InitializableJourneyService }>) {
  const [state, setState] = useState<JourneyProviderState>({ status: "loading" });
  const [snapshot, setSnapshot] = useState<JourneyDraft | null>(null);
  const [pendingRecoveryAction, setPendingRecoveryAction] = useState<PendingRecoveryAction | null>(null);
  const mountedRef = useRef(false);
  const currentServiceRef = useRef(service);
  const requestGenerationRef = useRef(0);
  const serviceGenerationRef = useRef(0);
  const recoveryActionRef = useRef<object | null>(null);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestGenerationRef.current += 1;
      serviceGenerationRef.current += 1;
      recoveryActionRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (currentServiceRef.current === service) return;
    currentServiceRef.current = service;
    requestGenerationRef.current += 1;
    serviceGenerationRef.current += 1;
    recoveryActionRef.current = null;
    setPendingRecoveryAction(null);
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

  const runRecoveryAction = useCallback(async (
    kind: PendingRecoveryAction,
    action: () => Promise<void>
  ) => {
    if (recoveryActionRef.current !== null) return;
    const token = {};
    recoveryActionRef.current = token;
    setPendingRecoveryAction(kind);

    try {
      await action();
    } catch {
      // Provider state already contains a safe, retryable error. Never surface the raw rejection.
    } finally {
      if (
        mountedRef.current
        && currentServiceRef.current === service
        && recoveryActionRef.current === token
      ) {
        recoveryActionRef.current = null;
        setPendingRecoveryAction(null);
      }
    }
  }, [service]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const context = useMemo(
    () => ({ service, snapshot, refresh, runAndRefresh }),
    [refresh, runAndRefresh, service, snapshot]
  );

  if (state.status === "loading") {
    return <StatusBanner message="正在恢复本机旅程…" variant="info" />;
  }
  if (state.status === "error") {
    const resetFailed = state.code === "journey-runtime-reset-failed";
    const actionKind: PendingRecoveryAction = resetFailed ? "reset" : "retry";
    const actionPending = pendingRecoveryAction === actionKind;
    const actionLabel = resetFailed ? "重置本机旅程" : "重试";
    const loadingLabel = resetFailed ? "正在重置…" : "正在重试…";
    return (
      <View style={{ gap: theme.space.md }}>
        <ErrorState
          message={resetFailed ? "重置失败，请重试。" : "读取失败，请重试。"}
          title={resetFailed ? "本机旅程需要恢复" : "无法读取本机旅程"}
        />
        <Text selectable style={{ ...theme.typography.caption, color: theme.color.textMuted }}>
          {`错误代码：${state.code}`}
        </Text>
        <Button
          label={actionPending ? loadingLabel : actionLabel}
          loading={actionPending}
          onPress={() => {
            void runRecoveryAction(
              actionKind,
              resetFailed ? reset : async () => initialize(false)
            );
          }}
        />
      </View>
    );
  }
  if (state.status === "recovery-required") {
    const resetPending = pendingRecoveryAction === "reset";
    return (
      <View style={{ gap: theme.space.md }}>
        <ErrorState
          message="当前本机草稿版本无法继续使用。重置后可以安全重新开始。"
          title="本机旅程需要恢复"
        />
        <Button
          label={resetPending ? "正在重置…" : "重置本机旅程"}
          loading={resetPending}
          onPress={() => {
            void runRecoveryAction("reset", reset);
          }}
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

import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
};

const JourneyContext = createContext<JourneyContextValue | null>(null);

export function JourneyProvider({
  service,
  children
}: PropsWithChildren<{ service: InitializableJourneyService }>) {
  const [state, setState] = useState<"loading" | "ready" | "error" | "recovery-required">("loading");
  const [snapshot, setSnapshot] = useState<JourneyDraft | null>(null);

  const refresh = useCallback(() => setSnapshot(service.getSnapshot()), [service]);
  const initialize = useCallback(async () => {
    setState("loading");
    try {
      const recovery = await service.initialize();
      refresh();
      setState(recovery === "ready" ? "ready" : "recovery-required");
    } catch {
      setState("error");
    }
  }, [refresh, service]);

  useEffect(() => { void initialize(); }, [initialize]);

  const context = useMemo(() => ({ service, snapshot, refresh }), [refresh, service, snapshot]);

  if (state === "loading") return <Text>正在恢复本机旅程…</Text>;
  if (state === "error") {
    return (
      <View>
        <Text>无法读取本机旅程</Text>
        <Pressable accessibilityRole="button" onPress={() => { void initialize(); }}>
          <Text>重试</Text>
        </Pressable>
      </View>
    );
  }
  if (state === "recovery-required") {
    return (
      <View>
        <Text>本机旅程需要恢复</Text>
        <Pressable accessibilityRole="button" onPress={() => {
          void service.resetJourney().then(initialize);
        }}>
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

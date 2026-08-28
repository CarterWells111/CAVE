import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Text } from "react-native";

import { useTheme } from "../src/core/design/theme-provider";
import { ErrorState } from "../src/core/ui/ErrorState";
import { Screen } from "../src/core/ui/Screen";
import { resolveShellLaunchPath } from "../src/features/shell/application/app-shell-service";
import { useJourneyRuntime } from "../src/features/journey/runtime/JourneyRuntimeProvider";

export default function IndexRoute() {
  const theme = useTheme();
  const router = useRouter();
  const { shellState } = useJourneyRuntime();
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const [status, setStatus] = useState<"loading" | "error">("loading");

  const launch = useCallback(async () => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    setStatus("loading");
    try {
      const completion = await shellState.load();
      if (mountedRef.current && requestRef.current === request) {
        router.replace(resolveShellLaunchPath({ completion }));
      }
    } catch {
      if (mountedRef.current && requestRef.current === request) setStatus("error");
    }
  }, [router, shellState]);

  useEffect(() => {
    mountedRef.current = true;
    void launch();
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, [launch]);

  return (
    <Screen contentContainerStyle={{ justifyContent: "center" }}>
      {status === "loading" ? (
        <Text accessibilityLiveRegion="polite" style={{ ...theme.typography.body, color: theme.color.text }}>
          正在打开内界 CAVE…
        </Text>
      ) : (
        <ErrorState
          actionLabel="重试"
          message="本机状态暂时无法读取。你的记录没有被删除。"
          onAction={() => { void launch(); }}
          title="无法读取本机状态"
        />
      )}
    </Screen>
  );
}

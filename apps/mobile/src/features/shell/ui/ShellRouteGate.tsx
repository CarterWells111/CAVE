import { Redirect, useRouter } from "expo-router";
import { type PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";
import { Text } from "react-native";

import { theme } from "../../../core/design/theme";
import { ErrorState } from "../../../core/ui/ErrorState";
import { Screen } from "../../../core/ui/Screen";
import {
  type JourneyRuntimeContextValue,
  useOptionalJourneyRuntime
} from "../../journey/runtime/JourneyRuntimeProvider";

type GateState = "loading" | "allowed" | "redirecting" | "error";

export function ShellRouteGate({ children }: PropsWithChildren) {
  const runtime = useOptionalJourneyRuntime();
  if (runtime === null) return <Redirect href="/journey/welcome" />;

  return <AuthorizedShellRouteGate shellState={runtime.shellState}>{children}</AuthorizedShellRouteGate>;
}

function AuthorizedShellRouteGate({
  children,
  shellState
}: PropsWithChildren<Pick<JourneyRuntimeContextValue, "shellState">>) {
  const router = useRouter();
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const [state, setState] = useState<GateState>("loading");

  const check = useCallback(async () => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    setState("loading");
    try {
      const completion = await shellState.load();
      if (!mountedRef.current || requestRef.current !== request) return;
      if (completion === null) {
        setState("redirecting");
        router.replace("/journey/welcome");
        return;
      }
      setState("allowed");
    } catch {
      if (mountedRef.current && requestRef.current === request) setState("error");
    }
  }, [router, shellState]);

  useEffect(() => {
    mountedRef.current = true;
    void check();
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, [check]);

  if (state === "allowed") return children;
  if (state === "error") {
    return (
      <Screen contentContainerStyle={{ justifyContent: "center" }}>
        <ErrorState
          actionLabel="重试"
          message="暂时无法确认首次记录是否完成。你的本机记录没有被删除。"
          onAction={() => { void check(); }}
          title="无法验证本机完成状态"
        />
      </Screen>
    );
  }
  return (
    <Screen contentContainerStyle={{ justifyContent: "center" }}>
      <Text accessibilityLiveRegion="polite" style={{ ...theme.typography.body, color: theme.color.text }}>
        {state === "redirecting" ? "正在返回首次旅程…" : "正在读取本机状态…"}
      </Text>
    </Screen>
  );
}

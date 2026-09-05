import { Redirect } from "expo-router";
import type { PropsWithChildren } from "react";

import { ErrorState } from "../../../core/ui/ErrorState";
import { Screen } from "../../../core/ui/Screen";
import { useOptionalJourneyRuntime } from "../../journey/runtime/JourneyRuntimeProvider";
import { ShellLoading } from "./shell-ui-components";
import { useJourneyMapAccess } from "./use-journey-map-access";

export function ExploreAccessGate({ children }: PropsWithChildren) {
  const runtime = useOptionalJourneyRuntime();
  const access = useJourneyMapAccess(runtime);
  if (runtime === null) return <Redirect href="/journey/welcome" />;
  if (access.status === "onboarding") return <Redirect href={runtime.snapshot?.ageConfirmed ? "/journey/preface" : "/journey/welcome"} />;
  if (access.status === "loading") return <Screen><ShellLoading /></Screen>;
  if (access.status === "error") return (
    <Screen>
      <ErrorState title="暂时无法打开旅程" message="无法确认本机引导状态。你的记录没有因此被删除。" actionLabel="重试" onAction={access.retry} />
    </Screen>
  );
  return children;
}

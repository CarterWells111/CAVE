import { useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "expo-router";
import { Pressable, Text } from "react-native";

import { JourneyRouteCoordinator } from "../application/journey-route-coordinator";
import type { JourneyDraft, JourneyPageId } from "../domain/types";
import { useJourneyRuntime } from "../runtime/JourneyRuntimeProvider";
import { JourneyScreenShell } from "./JourneyScreenShell";

type JourneyRouteRenderProps = {
  snapshot: JourneyDraft | null;
  controller: ReturnType<typeof useJourneyRuntime>["controller"];
  goTo(page: JourneyPageId): Promise<void>;
  runAndRefresh<T>(action: () => Promise<T>): Promise<T>;
};

export function JourneyRouteScreen({
  pageId,
  children
}: {
  pageId: JourneyPageId;
  children(props: JourneyRouteRenderProps): ReactNode;
}) {
  const router = useRouter();
  const runtime = useJourneyRuntime();
  const coordinator = useMemo(
    () => new JourneyRouteCoordinator(runtime.service, {
      replace: (path) => router.replace(path)
    }),
    [router, runtime.service]
  );
  const allowed = coordinator.guard(pageId);

  useEffect(() => {
    if (!allowed) router.replace("/journey/welcome");
  }, [allowed, router]);

  if (!allowed) return null;

  const runAndRefresh = runtime.runAndRefresh;
  const goTo = (page: JourneyPageId) => runAndRefresh(() => coordinator.goTo(page));
  const onBack = pageId === "welcome"
    ? undefined
    : () => { void runAndRefresh(() => coordinator.backFrom(pageId)); };

  return (
    <JourneyScreenShell pageId={pageId} {...(onBack === undefined ? {} : { onBack })}>
      {children({
        snapshot: runtime.snapshot,
        controller: runtime.controller,
        goTo,
        runAndRefresh
      })}
    </JourneyScreenShell>
  );
}

export function JourneyContinueButton({ onPress }: { onPress(): void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Text>继续</Text>
    </Pressable>
  );
}

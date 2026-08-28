import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useRouter } from "expo-router";

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
  const navigationActiveRef = useRef(true);
  const navigationGenerationRef = useRef(0);
  const guardCoordinator = useMemo(
    () => new JourneyRouteCoordinator(runtime.service, { replace: () => undefined }),
    [runtime.service]
  );
  const allowed = guardCoordinator.guard(pageId);

  useEffect(() => {
    navigationActiveRef.current = true;
    navigationGenerationRef.current += 1;

    return () => {
      navigationActiveRef.current = false;
      navigationGenerationRef.current += 1;
    };
  }, [pageId, runtime.service]);

  useEffect(() => {
    if (!allowed) router.replace("/journey/welcome");
  }, [allowed, router]);

  if (!allowed) return null;

  const runAndRefresh = runtime.runAndRefresh;
  const createActiveCoordinator = () => {
    const generation = navigationGenerationRef.current;
    return new JourneyRouteCoordinator(runtime.service, {
      replace: (path) => {
        if (
          navigationActiveRef.current &&
          navigationGenerationRef.current === generation
        ) {
          router.replace(path);
        }
      }
    });
  };
  const goTo = (page: JourneyPageId) => {
    const activeCoordinator = createActiveCoordinator();
    return runAndRefresh(() => activeCoordinator.goTo(page));
  };
  const onBack = pageId === "welcome"
    ? undefined
    : () => {
      const activeCoordinator = createActiveCoordinator();
      return runAndRefresh(() => activeCoordinator.backFrom(pageId));
    };
  const onExit = () => {
    navigationActiveRef.current = false;
    navigationGenerationRef.current += 1;
    router.replace("/");
  };

  return (
    <JourneyScreenShell
      pageId={pageId}
      onExit={onExit}
      {...(onBack === undefined ? {} : { onBack })}
    >
      {children({
        snapshot: runtime.snapshot,
        controller: runtime.controller,
        goTo,
        runAndRefresh
      })}
    </JourneyScreenShell>
  );
}

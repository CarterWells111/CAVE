import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import { Alert, Text } from "react-native";

import { theme } from "../../../core/design/theme";
import { BottomSheet } from "../../../core/ui/bottom-sheet";
import { Button } from "../../../core/ui/Button";
import { TextAction } from "../../../core/ui/text-action";
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
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [restartFailed, setRestartFailed] = useState(false);
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
  const onBack = pageId === "body-knowledge"
    ? () => {
      router.replace("/journey/preface");
      return Promise.resolve();
    }
    : () => {
      const activeCoordinator = createActiveCoordinator();
      return runAndRefresh(() => activeCoordinator.backFrom(pageId));
    };
  const exitJourney = () => {
    navigationActiveRef.current = false;
    navigationGenerationRef.current += 1;
    router.replace("/");
  };
  const restart = () => {
    setRestartFailed(false);
    Alert.alert("确认重新开始", "只会清除当前未完成的本机旅程草稿。", [
      { text: "取消", style: "cancel" },
      {
        text: "确认重新开始",
        style: "destructive",
        onPress: () => {
          void runtime.restart()
            .then(() => {
              setOptionsOpen(false);
              router.replace("/journey/welcome");
            })
            .catch(() => setRestartFailed(true));
        },
      },
    ]);
  };

  return (
    <>
      <JourneyScreenShell
        pageId={pageId}
        onExit={() => setOptionsOpen(true)}
        {...(onBack === undefined ? {} : { onBack })}
      >
        {children({
          snapshot: runtime.snapshot,
          controller: runtime.controller,
          goTo,
          runAndRefresh
        })}
      </JourneyScreenShell>
      <BottomSheet
        onClose={() => setOptionsOpen(false)}
        title="旅程选项"
        visible={optionsOpen}
      >
        <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>
          退出会保留当前本机草稿；重新开始会清除这份未完成草稿。
        </Text>
        {restartFailed ? (
          <Text accessibilityRole="alert" style={{ ...theme.typography.body, color: theme.color.error }}>
            重新开始失败，请重试。
          </Text>
        ) : null}
        {onBack ? (
          <TextAction label="返回上一步" onPress={() => {
            setOptionsOpen(false);
            void onBack();
          }} />
        ) : null}
        <Button label="退出旅程" onPress={exitJourney} />
        <TextAction label="重新开始" onPress={restart} />
      </BottomSheet>
    </>
  );
}

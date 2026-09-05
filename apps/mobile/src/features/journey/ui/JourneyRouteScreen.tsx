import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import { Alert, Text, type View } from "react-native";

import { onboardingHref } from "../../shell/application/journey-entry";
import { useTheme } from "../../../core/design/theme-provider";
import { BottomSheet } from "../../../core/ui/bottom-sheet";
import { Button } from "../../../core/ui/Button";
import { TextAction } from "../../../core/ui/text-action";
import { JOURNEY_PAGE_IDS } from "../application/journey-navigation";
import { JourneyRouteCoordinator } from "../application/journey-route-coordinator";
import type { JourneyDraft, JourneyPageId } from "../domain/types";
import { useJourneyRuntime } from "../runtime/JourneyRuntimeProvider";
import { JOURNEY_PAGE_TITLES, JourneyScreenShell } from "./JourneyScreenShell";
import {
  JourneyStepBackProvider,
  type JourneyStepBackRegistration,
} from "./journey-step-back";

type JourneyRouteRenderProps = {
  snapshot: JourneyDraft | null;
  controller: ReturnType<typeof useJourneyRuntime>["controller"];
  goTo(page: JourneyPageId): Promise<void>;
  runAndRefresh<T>(action: () => Promise<T>): Promise<T>;
};

export function JourneyRouteScreen({
  pageId,
  immersiveContent = false,
  navigationLocked = false,
  children
}: {
  pageId: JourneyPageId;
  immersiveContent?: boolean;
  navigationLocked?: boolean;
  children(props: JourneyRouteRenderProps): ReactNode;
}) {
  const theme = useTheme();
  const router = useRouter();
  const runtime = useJourneyRuntime();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsReturnFocusRef = useRef<View>(null);
  const [restartFailed, setRestartFailed] = useState(false);
  const [progressJumpFailed, setProgressJumpFailed] = useState(false);
  const [progressJumpTarget, setProgressJumpTarget] = useState<JourneyPageId | null>(null);
  const [stepBackRegistration, setStepBackRegistration] = useState<JourneyStepBackRegistration | null>(null);
  const progressJumpInFlightRef = useRef(false);
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
    ? undefined
    : () => {
      const activeCoordinator = createActiveCoordinator();
      return runAndRefresh(() => activeCoordinator.backFrom(pageId));
    };
  const activeStepBack = stepBackRegistration?.active === true ? stepBackRegistration : null;
  const effectiveBack = activeStepBack?.onBack ?? onBack;
  const effectiveNavigationLocked = navigationLocked || stepBackRegistration?.disabled === true;
  const exitJourney = () => {
    if (navigationLocked || progressJumpInFlightRef.current) return;
    navigationActiveRef.current = false;
    navigationGenerationRef.current += 1;
    router.replace("/(tabs)");
  };
  const restart = () => {
    if (progressJumpInFlightRef.current) return;
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
              router.replace(onboardingHref("/journey/welcome", "first-overnight"));
            })
            .catch(() => setRestartFailed(true));
        },
      },
    ]);
  };
  const openOptions = () => {
    if (navigationLocked) return;
    setProgressJumpFailed(false);
    setOptionsOpen(true);
  };
  const jumpToProgress = (targetPage: JourneyPageId) => {
    if (
      navigationLocked
      || targetPage === pageId
      || progressJumpInFlightRef.current
    ) return;

    const generation = navigationGenerationRef.current;
    const isCurrentOperation = () => (
      navigationActiveRef.current
      && navigationGenerationRef.current === generation
    );
    const activeCoordinator = createActiveCoordinator();
    progressJumpInFlightRef.current = true;
    setProgressJumpFailed(false);
    setProgressJumpTarget(targetPage);
    return runAndRefresh(() => activeCoordinator.jumpToProgress(targetPage))
      .then(() => {
        if (isCurrentOperation()) setOptionsOpen(false);
      })
      .catch(() => {
        if (isCurrentOperation()) setProgressJumpFailed(true);
      })
      .finally(() => {
        progressJumpInFlightRef.current = false;
        if (isCurrentOperation()) setProgressJumpTarget(null);
      });
  };

  return (
    <JourneyStepBackProvider setRegistration={setStepBackRegistration}>
      <JourneyScreenShell
        immersiveContent={immersiveContent}
        navigationLocked={effectiveNavigationLocked}
        pageId={pageId}
        onExit={openOptions}
        exitRef={optionsReturnFocusRef}
        {...(effectiveBack === undefined ? {} : { onBack: effectiveBack })}
      >
        {children({
          snapshot: runtime.snapshot,
          controller: runtime.controller,
          goTo,
          runAndRefresh
        })}
      </JourneyScreenShell>
      <BottomSheet
        dismissible={progressJumpTarget === null}
        onClose={() => { if (!progressJumpInFlightRef.current) setOptionsOpen(false); }}
        returnFocusRef={optionsReturnFocusRef}
        title="旅程选项"
        visible={optionsOpen}
      >
        <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>
          退出会保留当前本机草稿；重新开始会清除这份未完成草稿。
        </Text>
        <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>
          旅程进度
        </Text>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
          完成 18+ 成年确认、称呼和须知后，可以直接前往任意一页。跳过不会自动填写内容。
        </Text>
        {progressJumpFailed ? (
          <Text accessibilityRole="alert" style={{ ...theme.typography.body, color: theme.color.error }}>
            暂时无法切换旅程进度，请重试。
          </Text>
        ) : null}
        {JOURNEY_PAGE_IDS.map((targetPage, index) => {
          const current = targetPage === pageId;
          const label = `${index + 1}/${JOURNEY_PAGE_IDS.length} ${JOURNEY_PAGE_TITLES[targetPage]}${current ? "（当前页）" : ""}`;
          return (
            <TextAction
              disabled={current || progressJumpTarget !== null}
              key={targetPage}
              label={label}
              loading={progressJumpTarget === targetPage}
              onPress={() => jumpToProgress(targetPage)}
            />
          );
        })}
        {restartFailed ? (
          <Text accessibilityRole="alert" style={{ ...theme.typography.body, color: theme.color.error }}>
            重新开始失败，请重试。
          </Text>
        ) : null}
        <Button disabled={progressJumpTarget !== null} label="退出旅程" onPress={exitJourney} />
        <TextAction disabled={progressJumpTarget !== null} label="重新开始" onPress={restart} />
      </BottomSheet>
    </JourneyStepBackProvider>
  );
}

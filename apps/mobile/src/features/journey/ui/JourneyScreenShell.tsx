import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren, type RefObject } from "react";
import { BackHandler, KeyboardAvoidingView, PanResponder, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { HelpText, PageHeader } from "../../../core/ui/page-header";
import { ProgressHeader } from "../../../core/ui/ProgressHeader";
import { StatusBanner } from "../../../core/ui/StatusBanner";
import { JOURNEY_PAGE_IDS } from "../application/journey-navigation";
import type { JourneyPageId } from "../domain/types";
import type { JourneyAction as JourneyActionCallback } from "./journey-ui-contracts";
import type { JourneyRuntimeNotice } from "./journey-ui-contracts";
import { JourneyGuidedScrollScreen } from "./guided-scroll-screen";

const PAGE_HELP: Record<JourneyPageId, string> = {
  "body-knowledge": "按自己的节奏阅读身体与安全知识。外阴结构图可选，不查看也可以继续。",
  overnight: "点击卡牌，留下期待与在意，也可以返回修改。这些感受可以同时被留下，不需要现在整理成一个确定答案。",
  "behavior-map": "点击卡牌，分别选择此刻对每种行为的感受。可以修改或暂不选择；更多具体行为会先征求你的查看意愿。",
  reflection: "可以按自己的节奏阅读。此刻的感受不构成承诺，之后仍可以改变主意。",
  "final-preparation": "回顾一下，留下想保存的内容。七段内容排成一列。你可以编辑，也可以暂时删除；删除后的内容会变灰，确认前随时可以恢复。",
};

export const JOURNEY_PAGE_TITLES: Record<JourneyPageId, string> = {
  "body-knowledge": "身体与安全知识",
  overnight: "过夜期待与在意",
  "behavior-map": "行为地图与边界",
  reflection: "你随时可以改变主意",
  "final-preparation": "我的沟通草稿"
};

type Props = PropsWithChildren<{
  pageId: JourneyPageId;
  immersiveContent?: boolean;
  navigationLocked?: boolean;
  onBack?: JourneyActionCallback | undefined;
  onExit: JourneyActionCallback;
  runtimeNotice?: JourneyRuntimeNotice;
  exitRef?: RefObject<View | null> | undefined;
}>;

type BackState = "idle" | "loading" | "error";

type JourneyBackGesture = Readonly<{
  startX: number;
  dx: number;
  dy: number;
}>;

const BACK_EDGE_WIDTH = 24;
const BACK_GESTURE_CLAIM_DISTANCE = 12;
const BACK_GESTURE_COMPLETE_DISTANCE = 64;
const BACK_GESTURE_HORIZONTAL_RATIO = 1.5;

export function shouldClaimJourneyBackGesture({ startX, dx, dy }: JourneyBackGesture) {
  return startX <= BACK_EDGE_WIDTH
    && dx >= BACK_GESTURE_CLAIM_DISTANCE
    && dx >= Math.abs(dy) * BACK_GESTURE_HORIZONTAL_RATIO;
}

export function shouldCompleteJourneyBackGesture(gesture: JourneyBackGesture) {
  return gesture.dx >= BACK_GESTURE_COMPLETE_DISTANCE
    && shouldClaimJourneyBackGesture(gesture);
}

export function JourneyScreenShell({
  pageId,
  immersiveContent = false,
  navigationLocked = false,
  onBack,
  onExit,
  runtimeNotice,
  exitRef,
  children
}: Props) {
  const theme = useTheme();
  const pageNumber = JOURNEY_PAGE_IDS.indexOf(pageId) + 1;
  const mountedRef = useRef(false);
  const pageGenerationRef = useRef(0);
  const operationGenerationRef = useRef(0);
  const backInFlightRef = useRef(false);
  const [backState, setBackState] = useState<BackState>("idle");

  useEffect(() => {
    mountedRef.current = true;
    const pageGeneration = ++pageGenerationRef.current;
    operationGenerationRef.current += 1;
    backInFlightRef.current = false;
    setBackState("idle");

    return () => {
      mountedRef.current = false;
      if (pageGenerationRef.current === pageGeneration) pageGenerationRef.current += 1;
      operationGenerationRef.current += 1;
      backInFlightRef.current = false;
    };
  }, [pageId]);

  const handleBack = useCallback(() => {
    if (!onBack || navigationLocked || backInFlightRef.current) return;

    const pageGeneration = pageGenerationRef.current;
    const operationGeneration = ++operationGenerationRef.current;
    const isCurrentOperation = () => (
      mountedRef.current
      && pageGenerationRef.current === pageGeneration
      && operationGenerationRef.current === operationGeneration
    );

    backInFlightRef.current = true;
    setBackState("loading");
    try {
      const result = onBack();
      if (result && typeof result.then === "function") {
        void Promise.resolve(result)
          .then(() => {
            if (isCurrentOperation()) setBackState("idle");
          })
          .catch(() => {
            if (isCurrentOperation()) setBackState("error");
          })
          .finally(() => {
            if (isCurrentOperation()) backInFlightRef.current = false;
          });
        return;
      }

      if (isCurrentOperation()) setBackState("idle");
    } catch {
      if (isCurrentOperation()) setBackState("error");
    }
    if (isCurrentOperation()) backInFlightRef.current = false;
  }, [navigationLocked, onBack]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });
    return () => subscription.remove();
  }, [handleBack]);

  const backPanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gestureState) => (
      onBack !== undefined
      && !navigationLocked
      && !backInFlightRef.current
      && shouldClaimJourneyBackGesture({
        startX: gestureState.x0,
        dx: gestureState.dx,
        dy: gestureState.dy,
      })
    ),
    onPanResponderRelease: (_, gestureState) => {
      if (shouldCompleteJourneyBackGesture({
        startX: gestureState.x0,
        dx: gestureState.dx,
        dy: gestureState.dy,
      })) handleBack();
    },
  }), [handleBack, navigationLocked, onBack]);

  return (
    <View
      {...backPanResponder.panHandlers}
      style={{ backgroundColor: theme.color.background, flex: 1 }}
      testID={`journey-page-${pageId}`}
    >
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        testID="journey-keyboard-avoiding"
      >
        <JourneyGuidedScrollScreen
          fixedHeader={(
            <ProgressHeader
              backLabel={backState === "loading" ? "正在返回…" : "返回上一步"}
              backBusy={backState === "loading"}
              backDisabled={navigationLocked || backState === "loading"}
              currentPage={pageNumber}
              showProgress
              totalPages={JOURNEY_PAGE_IDS.length}
              onExit={onExit}
              exitDisabled={navigationLocked}
              exitLabel="旅程选项"
              exitRef={exitRef}
              testID="journey-progress-header"
              {...(pageNumber > 1 && onBack ? { onBack: handleBack } : {})}
            />
          )}
          keyboardDismissMode="interactive"
          resetKey={pageId}
          scrollResetKey={immersiveContent}
          testID="journey-scroll"
        >
          {!immersiveContent ? (
            <View testID="journey-title-card">
              <PageHeader title={JOURNEY_PAGE_TITLES[pageId]} help={<HelpText>{PAGE_HELP[pageId]}</HelpText>} />
            </View>
          ) : null}
          {runtimeNotice && !immersiveContent ? (
            <StatusBanner
              accessibilityLabel={runtimeNotice.accessibilityLabel}
              message={runtimeNotice.message}
              variant="info"
            />
          ) : null}
          {backState === "error" ? (
            <StatusBanner message="返回失败，请重试。" variant="error" />
          ) : null}
          {children}
        </JourneyGuidedScrollScreen>
      </KeyboardAvoidingView>
    </View>
  );
}

import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { KeyboardAvoidingView, Text, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Card } from "../../../core/ui/Card";
import { ProgressHeader } from "../../../core/ui/ProgressHeader";
import { StatusBanner } from "../../../core/ui/StatusBanner";
import { JOURNEY_PAGE_IDS } from "../application/journey-navigation";
import type { JourneyPageId } from "../domain/types";
import type { JourneyAction as JourneyActionCallback } from "./journey-ui-contracts";
import type { JourneyRuntimeNotice } from "./journey-ui-contracts";
import { JourneyGuidedScrollScreen } from "./guided-scroll-screen";

const JOURNEY_PAGE_TITLES: Record<JourneyPageId, string> = {
  "body-knowledge": "身体与安全知识",
  overnight: "过夜期待与在意",
  "behavior-map": "行为地图与边界",
  reflection: "自我反思",
  "preset-practice": "预设沟通练习",
  "final-preparation": "私密准备与沟通草稿"
};

type Props = PropsWithChildren<{
  pageId: JourneyPageId;
  onBack?: JourneyActionCallback | undefined;
  onExit: JourneyActionCallback;
  runtimeNotice?: JourneyRuntimeNotice;
}>;

type BackState = "idle" | "loading" | "error";

export function JourneyScreenShell({
  pageId,
  onBack,
  onExit,
  runtimeNotice,
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

  const handleBack = () => {
    if (!onBack || backInFlightRef.current) return;

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
  };

  return (
    <View
      style={{ backgroundColor: theme.color.background, flex: 1 }}
      testID={`journey-page-${pageId}`}
    >
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        testID="journey-keyboard-avoiding"
      >
        <JourneyGuidedScrollScreen
          keyboardDismissMode="interactive"
          resetKey={pageId}
          testID="journey-scroll"
        >
          <ProgressHeader
            backLabel={backState === "loading" ? "正在返回…" : "返回上一页"}
            backBusy={backState === "loading"}
            backDisabled={backState === "loading"}
            currentPage={pageNumber}
            showProgress
            totalPages={6}
            onExit={onExit}
            exitLabel="旅程选项"
            testID="journey-progress-header"
            {...(pageNumber > 1 && onBack ? { onBack: handleBack } : {})}
          />
          <Card accessible={false} testID="journey-title-card">
            <Text
              accessibilityRole="header"
              selectable
              style={{ ...theme.typography.title, color: theme.color.text }}
            >
              {JOURNEY_PAGE_TITLES[pageId]}
            </Text>
          </Card>
          {runtimeNotice ? (
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

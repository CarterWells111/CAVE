import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { BackHandler, Image, Text, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { ProgressHeader } from "../../../core/ui/ProgressHeader";
import { Screen } from "../../../core/ui/Screen";
import { TextAction } from "../../../core/ui/text-action";
import { HelpText, PageHeader } from "../../../core/ui/page-header";
import type { SampleJourney } from "../catalog";

// This is the same optional, expert-review-pending image used by the existing body-knowledge page.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vulvaDiagram = require("../../../../../../assets/medical/vulva-anatomy-review-current.png");

type SampleJourneyScreenProps = {
  journey: SampleJourney;
  onExit: () => void;
};

function SampleJourneyPages({ journey, onExit }: SampleJourneyScreenProps) {
  const theme = useTheme();
  const [pageIndex, setPageIndex] = useState(0);
  const [diagramOpen, setDiagramOpen] = useState(false);
  const page = journey.pages[pageIndex]!;
  const isLastPage = pageIndex === journey.pages.length - 1;
  const goBack = useCallback(() => {
    if (pageIndex === 0) onExit();
    else setPageIndex((current) => Math.max(0, current - 1));
  }, [onExit, pageIndex]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack]);

  return (
    <Screen
      fixedHeader={(
        <ProgressHeader
          currentPage={pageIndex + 1}
          onExit={onExit}
          showProgress
          totalPages={journey.pages.length}
          {...(pageIndex > 0 ? { onBack: goBack } : {})}
        />
      )}
      scrollResetKey={pageIndex}
      testID="sample-journey-scroll"
    >
      <View style={{ flexGrow: 1, gap: theme.space.xl, minWidth: 0 }}>
        <View style={{ gap: theme.space.sm }}>
          <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
            {journey.title}
          </Text>
          <Text selectable style={{ ...theme.typography.label, color: theme.color.primary }}>
            {journey.preview ? "样板 · 框架预览" : "身体知识 · 待专业复核"}
          </Text>
        </View>
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            alignItems: "center", alignSelf: "flex-start", backgroundColor: theme.color.surfaceAccent,
            borderColor: theme.color.borderSoft, borderRadius: theme.radius.pill, borderWidth: theme.border.width,
            height: 88, justifyContent: "center", width: 88,
          }}
        >
          <Ionicons accessible={false} color={theme.color.primary} name={journey.icon} size={36} />
        </View>
        <View style={{ gap: theme.space.md }}>
          <PageHeader title={page.title} help={<HelpText>{journey.preview
            ? "这是三页框架预览，不会保存答案。可用上一页或退出返回地图。"
            : "按自己的节奏阅读身体知识。结构图可选，不查看也可以继续。内容与医学图仍待专业复核。"}</HelpText>} />
          <Text selectable style={{ ...theme.typography.body, color: theme.color.text, flexShrink: 1 }}>
            {page.body}
          </Text>
          {page.showVulvaDiagram ? (
            <View style={{ gap: theme.space.sm }}>
              <TextAction
                label={diagramOpen ? "收起外阴结构图" : "查看外阴结构图"}
                onPress={() => setDiagramOpen((current) => !current)}
              />
              {diagramOpen ? (
                <View style={{ gap: theme.space.sm }}>
                  <Image
                    accessibilityLabel="医学图审核稿：阴阜、大阴唇、阴蒂、小阴唇、尿道口、阴道口、肛门"
                    accessibilityRole="image"
                    resizeMode="contain"
                    source={vulvaDiagram}
                    style={{ aspectRatio: 16 / 9, width: "100%" }}
                  />
                  <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
                    医学图审核稿
                  </Text>
                </View>
              ) : (
                <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
                  可选，不查看也可以继续
                </Text>
              )}
            </View>
          ) : null}
        </View>
        <View style={{ flexGrow: 1 }} />
        <Button
          label={isLastPage ? "返回地图" : "下一页"}
          onPress={isLastPage ? onExit : () => setPageIndex((current) => Math.min(journey.pages.length - 1, current + 1))}
        />
      </View>
    </Screen>
  );
}

export function SampleJourneyScreen(props: SampleJourneyScreenProps) {
  // This key intentionally makes every different sample a fresh, local-only preview.
  return <SampleJourneyPages key={props.journey.id} {...props} />;
}

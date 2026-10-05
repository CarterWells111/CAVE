import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Alert, BackHandler, Image, Linking, Pressable, Text, useWindowDimensions, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { InfoCard } from "../../../core/ui/info-card";
import { ProgressHeader } from "../../../core/ui/ProgressHeader";
import { contentHorizontalPadding, Screen } from "../../../core/ui/Screen";
import { HelpText, PageHeader } from "../../../core/ui/page-header";
import { TextAction } from "../../../core/ui/text-action";
import type { SampleJourney } from "../catalog";

// Crop the existing expert-review-pending illustration in the UI, preserving its original asset.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vulvaDiagram = require("../../../../../../assets/medical/vulva-anatomy-review-current.png");
const diagramAsset = Image.resolveAssetSource(vulvaDiagram);
const diagramSourceWidth = diagramAsset?.width || 1600;
const diagramSourceHeight = diagramAsset?.height || 900;
const diagramCrop = { left: 445, top: 85, width: 690, height: 800 } as const;
// The source image has flat margins; cover only the leader-line tails outside the number badges.
const diagramBackground = "#F1F1F0";
const diagramParts = [
  { number: 1, name: "阴阜", description: "外阴上方的隆起区域。", side: "right", x: 1085, y: 146 },
  { number: 2, name: "大阴唇", description: "外侧的两片皮肤褶皱，围在其他外阴结构外面。", side: "left", x: 480, y: 307 },
  { number: 3, name: "阴蒂", description: "位于外阴上方的敏感器官；图中可见的只是它的一部分。", side: "right", x: 1085, y: 317 },
  { number: 4, name: "小阴唇", description: "内侧的两片皮肤褶皱，围绕尿道口和阴道口。", side: "left", x: 480, y: 469 },
  { number: 5, name: "尿道口", description: "尿液从身体排出的开口。", side: "right", x: 1085, y: 415 },
  { number: 6, name: "阴道口", description: "通往体内阴道的开口。", side: "right", x: 1085, y: 528 },
  { number: 7, name: "肛门", description: "位于阴道口下方，是消化道末端的开口，不属于外阴。", side: "right", x: 1085, y: 776 },
] as const;

function DiagramButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center", backgroundColor: pressed ? "#542342" : "#6D345A",
        borderRadius: theme.radius.control, justifyContent: "center",
        minHeight: theme.size.primaryActionHeight, paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.compact, width: "100%",
      })}
    >
      <Text style={{ ...theme.typography.button, color: "#FFFFFF", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

function openArticle(url: string) {
  void Linking.openURL(url).catch(() => {
    Alert.alert("暂时无法打开文章", "请检查网络连接后重试。");
  });
}

type SampleJourneyScreenProps = {
  journey: SampleJourney;
  onExit: () => void;
};

function SampleJourneyPages({ journey, onExit }: SampleJourneyScreenProps) {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [pageIndex, setPageIndex] = useState(0);
  const [diagramVisible, setDiagramVisible] = useState(false);
  const page = journey.pages[pageIndex]!;
  const contentWidth = Math.max(
    1,
    Math.min(windowWidth, theme.size.readableContentMax) - 2 * contentHorizontalPadding(windowWidth),
  );
  const diagramWidth = Math.min(contentWidth, 480);
  const diagramScale = diagramWidth / diagramCrop.width;
  const markerSize = 26;
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
            : "按自己的节奏阅读身体知识。内容与医学图仍待专业复核。"}</HelpText>} />
          <Text selectable style={{ ...theme.typography.body, color: theme.color.text, flexShrink: 1 }}>
            {page.body}
          </Text>
          {page.showVulvaDiagram ? (
            <View style={{ alignSelf: "center", gap: theme.space.md, maxWidth: 480, width: "100%" }}>
              {diagramVisible ? (
                <View style={{ gap: theme.space.md }}>
                  <View
                    style={{ alignSelf: "center", height: diagramCrop.height * diagramScale, overflow: "hidden", width: diagramWidth }}
                    testID="journey-01-diagram-viewport"
                  >
                    <Image
                      accessibilityLabel="外阴结构示意图，数字 1 至 7 的部位说明列于图下"
                      accessibilityRole="image"
                      source={vulvaDiagram}
                      style={{
                        height: diagramSourceHeight * diagramScale,
                        left: -diagramCrop.left * diagramScale,
                        position: "absolute",
                        top: -diagramCrop.top * diagramScale,
                        width: diagramSourceWidth * diagramScale,
                      }}
                      testID="journey-01-diagram"
                    />
                    {diagramParts.map((part) => {
                      const markerCenter = (part.x - diagramCrop.left) * diagramScale;
                      const maskLeft = part.side === "left" ? 0 : markerCenter + markerSize / 2;
                      const maskWidth = part.side === "left" ? markerCenter - markerSize / 2 : diagramWidth - maskLeft;
                      return (
                        <View
                          accessible={false}
                          key={`line-tail-${part.number}`}
                          style={{
                            backgroundColor: diagramBackground, height: 8, left: maskLeft,
                            position: "absolute", top: (part.y - diagramCrop.top) * diagramScale - 4,
                            width: Math.max(0, maskWidth),
                          }}
                          testID={`journey-01-line-tail-${part.number}`}
                        />
                      );
                    })}
                    {diagramParts.map((part) => (
                      <View
                        accessible={false}
                        importantForAccessibility="no-hide-descendants"
                        key={part.number}
                        style={{
                          alignItems: "center", backgroundColor: "#6D345A", borderRadius: markerSize / 2,
                          height: markerSize, justifyContent: "center",
                          left: (part.x - diagramCrop.left) * diagramScale - markerSize / 2,
                          position: "absolute",
                          top: (part.y - diagramCrop.top) * diagramScale - markerSize / 2,
                          width: markerSize,
                        }}
                      >
                        <Text allowFontScaling={false} style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}>
                          {part.number}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <DiagramButton label="隐藏图片" onPress={() => setDiagramVisible(false)} />
                </View>
              ) : (
                <View style={{
                  backgroundColor: "#F2E3E9", borderColor: "#DDCDD4", borderRadius: theme.radius.feature,
                  borderWidth: theme.border.width, gap: theme.space.md, padding: theme.space.lg,
                }}>
                  <Text style={{ ...theme.typography.heading, color: "#33262D" }}>温馨提示｜外阴结构图</Text>
                  <Text style={{ ...theme.typography.body, color: "#33262D" }}>
                    接下来是一张外阴结构示意图，画面会比较直观。想看的时候再点开就好；现在不看，也可以先读下方的部位说明。
                  </Text>
                  <DiagramButton label="确认点开" onPress={() => setDiagramVisible(true)} />
                </View>
              )}
              <View style={{ gap: theme.space.sm }}>
                {diagramParts.map((part) => (
                  <View key={part.number} style={{ gap: theme.space.xs }}>
                    <Text selectable style={{ ...theme.typography.label, color: theme.color.text }}>
                      {part.number} {part.name}
                    </Text>
                    <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
                      {part.description}
                    </Text>
                  </View>
                ))}
              </View>
              <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
                医学图审核稿 · 部位说明参考美国妇产科医师学会（ACOG）与英国国民医疗服务体系（NHS）资料
              </Text>
            </View>
          ) : null}
          {page.article ? (
            <InfoCard title={page.article.title} variant="medical">
              <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>
                {page.article.summary}
              </Text>
              <TextAction
                label={`阅读中文简述：${page.article.title}\n参考自${page.article.organization}的患者资料`}
                onPress={() => openArticle(page.article!.url)}
                underlined
              />
            </InfoCard>
          ) : null}
          {page.webLink ? (
            <TextAction
              label={page.webLink.label}
              onPress={() => openArticle(page.webLink!.url)}
              underlined
            />
          ) : null}
        </View>
        <View style={{ flexGrow: 1 }} />
        <Button
          label={isLastPage ? "返回地图" : "下一页"}
          onPress={isLastPage ? onExit : () => {
            setDiagramVisible(false);
            setPageIndex((current) => Math.min(journey.pages.length - 1, current + 1));
          }}
        />
      </View>
    </Screen>
  );
}

export function SampleJourneyScreen(props: SampleJourneyScreenProps) {
  // This key intentionally makes every different sample a fresh, local-only preview.
  return <SampleJourneyPages key={props.journey.id} {...props} />;
}

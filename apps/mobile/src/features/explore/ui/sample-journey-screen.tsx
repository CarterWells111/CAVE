import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, Image, Linking, Pressable, Text, useWindowDimensions, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { InfoCard } from "../../../core/ui/info-card";
import { ProgressHeader } from "../../../core/ui/ProgressHeader";
import { contentHorizontalPadding, Screen } from "../../../core/ui/Screen";
import { PageHeader } from "../../../core/ui/page-header";
import { TextAction } from "../../../core/ui/text-action";
import type { SampleJourney } from "../catalog";
import type { PreferenceCardRepository } from "../preference-card";
import { JourneyKnowledgeCard } from "./journey-knowledge-card";
import { PreferenceCardEditor } from "./preference-card-editor";

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
const VULVA_SELF_EXAM_URL = "https://www.newcastle-hospitals.nhs.uk/resources/self-examination-of-the-vulva/";

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
  preferenceCards?: PreferenceCardRepository | undefined;
  preferenceCardOwner?: string | undefined;
  preferenceCardPersistence?: "memory-only" | "sqlcipher-secure-store" | undefined;
};

function SampleJourneyPages({ journey, onExit, preferenceCards, preferenceCardOwner, preferenceCardPersistence }: SampleJourneyScreenProps) {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [pageIndex, setPageIndex] = useState(0);
  const [diagramVisible, setDiagramVisible] = useState(false);
  const [preferenceCardDirty, setPreferenceCardDirty] = useState(false);
  const [diagramLoadState, setDiagramLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [diagramLoadAttempt, setDiagramLoadAttempt] = useState(0);
  const page = journey.pages[pageIndex]!;
  const contentWidth = Math.max(
    1,
    Math.min(windowWidth, theme.size.readableContentMax) - 2 * contentHorizontalPadding(windowWidth),
  );
  const diagramWidth = Math.min(contentWidth, 480);
  const diagramScale = diagramWidth / diagramCrop.width;
  const markerSize = 26;
  const isLastPage = pageIndex === journey.pages.length - 1;
  const confirmLeave = useCallback((proceed: () => void) => {
    if (!preferenceCardDirty) {
      proceed();
      return;
    }
    Alert.alert("偏好卡尚未保存", "离开后，当前修改会丢失。", [
      { text: "继续编辑", style: "cancel" },
      { text: "放弃修改", style: "destructive", onPress: () => {
        setPreferenceCardDirty(false);
        proceed();
      } },
    ]);
  }, [preferenceCardDirty]);
  const goBack = useCallback(() => {
    confirmLeave(() => {
      if (pageIndex === 0) onExit();
      else setPageIndex((current) => Math.max(0, current - 1));
    });
  }, [confirmLeave, onExit, pageIndex]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack]);

  useEffect(() => {
    if (!journey.pages.some((candidate) => candidate.showVulvaDiagram)) return;
    const uri = Image.resolveAssetSource(vulvaDiagram)?.uri;
    if (uri) void Image.prefetch(uri).catch(() => undefined);
  }, [journey]);

  return (
    <Screen
      compactFixedHeader
      contentContainerStyle={{ paddingTop: theme.space.xs }}
      fixedHeader={(
        <ProgressHeader
          compact
          currentPage={pageIndex + 1}
          onExit={() => confirmLeave(onExit)}
          showProgress
          totalPages={journey.pages.length}
          {...(pageIndex > 0 ? { onBack: goBack } : {})}
        />
      )}
      scrollResetKey={pageIndex}
      testID="sample-journey-scroll"
    >
      <View style={{ flexGrow: 1, gap: theme.space.compact, minWidth: 0 }}>
        <View style={{ alignItems: "baseline", columnGap: theme.space.sm, flexDirection: "row", flexWrap: "wrap", rowGap: theme.space.xs }}>
          <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
            {journey.title}
          </Text>
          <Text selectable style={{ ...theme.typography.label, color: theme.color.primary }}>
            {journey.statusLabel ?? (journey.preview ? "样板 · 框架预览" : "身体知识 · 待专业复核")}
          </Text>
        </View>
        <View style={{ gap: theme.space.md }}>
          <PageHeader title={page.title} />
          <Text selectable style={{ ...theme.typography.body, color: theme.color.text, flexShrink: 1 }}>
            {page.body}
          </Text>
          {page.cards ? (
            <View style={{ gap: theme.space.sm }}>
              {page.cards.map((card) => <JourneyKnowledgeCard card={card} key={card.title} onOpenSource={openArticle} />)}
            </View>
          ) : null}
          {page.footer ? (
            <View style={{
              backgroundColor: theme.color.surfaceAccent,
              borderColor: theme.color.borderSoft,
              borderRadius: theme.radius.control,
              borderWidth: theme.border.width,
              padding: theme.space.md,
            }}>
              <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>
                {page.footer}
              </Text>
            </View>
          ) : null}
          {page.preferenceCard ? preferenceCards && preferenceCardOwner ? (
            <PreferenceCardEditor
              ownerId={preferenceCardOwner}
              onDirtyChange={setPreferenceCardDirty}
              persistence={preferenceCardPersistence ?? "memory-only"}
              repository={preferenceCards}
            />
          ) : (
            <Text accessibilityRole="alert" style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
              暂时无法读取偏好卡，请重新进入旅程后重试。
            </Text>
          ) : null}
          {page.showVulvaDiagram ? (
            <View style={{ alignSelf: "center", gap: theme.space.md, maxWidth: 480, width: "100%" }}>
              {diagramVisible ? (
                <View style={{ gap: theme.space.md }}>
                  {diagramLoadState === "error" ? (
                    <View style={{ gap: theme.space.md }}>
                      <Text accessibilityRole="alert" style={{ ...theme.typography.body, color: theme.color.text }}>
                        图片加载失败，请重试。
                      </Text>
                      <DiagramButton label="重试加载图片" onPress={() => {
                        setDiagramLoadState("loading");
                        setDiagramLoadAttempt((attempt) => attempt + 1);
                      }} />
                    </View>
                  ) : (
                    <View
                      style={{ alignSelf: "center", backgroundColor: theme.color.surface, height: diagramCrop.height * diagramScale, overflow: "hidden", width: diagramWidth }}
                      testID="journey-01-diagram-viewport"
                    >
                      <Image
                        accessibilityLabel="外阴结构示意图，数字 1 至 7 的部位说明列于图下"
                        accessibilityRole="image"
                        key={diagramLoadAttempt}
                        onError={() => setDiagramLoadState("error")}
                        onLoad={() => setDiagramLoadState("ready")}
                        source={vulvaDiagram}
                        style={{
                          height: diagramSourceHeight * diagramScale,
                          left: -diagramCrop.left * diagramScale,
                          opacity: diagramLoadState === "ready" ? 1 : 0,
                          position: "absolute",
                          top: -diagramCrop.top * diagramScale,
                          width: diagramSourceWidth * diagramScale,
                        }}
                        testID="journey-01-diagram"
                      />
                      {diagramLoadState === "loading" ? (
                        <View style={{ alignItems: "center", bottom: 0, gap: theme.space.sm, justifyContent: "center", left: 0, position: "absolute", right: 0, top: 0 }}>
                          <ActivityIndicator color={theme.color.primary} />
                          <Text accessibilityLiveRegion="polite" style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
                            结构图正在加载…
                          </Text>
                        </View>
                      ) : null}
                      {diagramLoadState === "ready" ? diagramParts.map((part) => {
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
                      }) : null}
                      {diagramLoadState === "ready" ? diagramParts.map((part) => (
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
                      )) : null}
                    </View>
                  )}
                  <DiagramButton label="隐藏图片" onPress={() => setDiagramVisible(false)} />
                  <View style={{ backgroundColor: theme.color.surface, borderRadius: theme.radius.control, gap: theme.space.sm, padding: theme.space.md }}>
                    <Text selectable style={{ ...theme.typography.cardTitle, color: theme.color.text }}>
                      想认识自己的外阴？
                    </Text>
                    <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>
                      如果你愿意，可以在私密、光线充足的地方，用小镜子对照上方的图辨认外阴各部位。你的外观不必和示意图相同。
                    </Text>
                    <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>
                      也可以用自己的手机拍照，供自己查看。若想只保留在本机，先确认相册的自动备份和共享设置；这个页面不会读取或上传照片。
                    </Text>
                    <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
                      观察和拍照都由你决定。如果有持续疼痛、瘙痒或明显的新变化，可以咨询医护人员。
                    </Text>
                    <TextAction label="查看英文参考：NHS 外阴自我观察指南" onPress={() => openArticle(VULVA_SELF_EXAM_URL)} underlined />
                  </View>
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
                  <DiagramButton label="确认点开" onPress={() => {
                    setDiagramLoadState("loading");
                    setDiagramVisible(true);
                  }} />
                </View>
              )}
              <View style={{ width: "100%" }}>
                {diagramParts.map((part, index) => (
                  <View
                    key={part.number}
                    style={{
                      alignItems: "flex-start", borderBottomColor: theme.color.borderSoft,
                      borderBottomWidth: index < diagramParts.length - 1 ? theme.border.width : 0,
                      flexDirection: "row", gap: theme.space.compact, paddingVertical: theme.space.compact,
                    }}
                  >
                    <View
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      style={{
                        alignItems: "center", backgroundColor: theme.color.surfaceAccent,
                        borderRadius: 14, height: 28, justifyContent: "center", width: 28,
                      }}
                    >
                      <Text style={{ ...theme.typography.caption, color: theme.color.primary, fontWeight: "600" }}>
                        {part.number}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: theme.space.xs, minWidth: 0 }}>
                      <Text accessibilityLabel={`${part.number} ${part.name}`} selectable style={{ ...theme.typography.button, color: theme.color.text, flexShrink: 1 }}>
                        {part.name}
                      </Text>
                      <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary, flexShrink: 1 }}>
                        {part.description}
                      </Text>
                    </View>
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
          onPress={isLastPage ? () => confirmLeave(onExit) : () => {
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

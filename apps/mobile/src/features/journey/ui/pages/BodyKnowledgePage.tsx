import type {
  JourneyBodyKnowledgeDefinition,
  JourneyKnowledgeCard,
} from "@cave/content";
import { useRef, useState } from "react";
import { Image, type ImageSourcePropType, ScrollView, Text, View } from "react-native";

import { useTheme } from "../../../../core/design/theme-provider";
import type { AppTheme } from "../../../../core/design/theme";
import { BottomSheet } from "../../../../core/ui/bottom-sheet";
import { Card } from "../../../../core/ui/Card";
import { InfoCard } from "../../../../core/ui/info-card";
import { SecondaryButton } from "../../../../core/ui/secondary-button";
import { TextAction } from "../../../../core/ui/text-action";
import { JourneyAction } from "../components/JourneyAction";

type ActionResult = void | Promise<void>;

export type BodyKnowledgePageProps = {
  cards: JourneyKnowledgeCard[];
  definition: JourneyBodyKnowledgeDefinition;
  onContinue: () => ActionResult;
  onRead?: (id: string) => ActionResult;
  onOpenDiagram?: () => ActionResult;
  onOpenSources?: () => ActionResult;
  diagramSource?: ImageSourcePropType;
  addressPreference?: "你" | "妳";
  reducedMotion?: boolean;
};

export function BodyKnowledgePage({
  cards,
  definition,
  onContinue,
  onRead,
  onOpenDiagram,
  onOpenSources,
  diagramSource,
  addressPreference = "你",
  reducedMotion,
}: BodyKnowledgePageProps) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const sortedCards = [...cards].sort((a, b) => a.order - b.order).slice(0, 3);
  const [consentOpen, setConsentOpen] = useState(false);
  const diagramTriggerRef = useRef<View>(null);
  const [diagramOpen, setDiagramOpen] = useState(false);
  const [diagramZoom, setDiagramZoom] = useState(1);
  const [imageAttempt, setImageAttempt] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [imageStatus, setImageStatus] = useState("");

  const complete = async () => {
    for (const card of sortedCards) await onRead?.(card.id);
    await onContinue();
  };

  const revealDiagram = async () => {
    await onOpenDiagram?.();
    setDiagramZoom(1);
    setImageError(false);
    setImageStatus("");
    setConsentOpen(false);
    setDiagramOpen(true);
  };
  const zoomPercent = Math.round(diagramZoom * 100);

  return (
    <View style={styles.page} testID="page-1-content">
      <Text accessibilityRole="header" style={styles.title}>身体会回应，决定仍属于{addressPreference}</Text>
      <Text style={styles.body}>认识身体，不是为了找到一条必须走完的路线。它帮助{addressPreference}分清身体正在发生什么，以及自己是否愿意。</Text>

      <InfoCard testID="body-anatomy-education" title="先认识外阴、阴道与阴蒂" variant="medical">
        <Text selectable style={styles.body}>外阴是身体外部可见的区域；阴道是一条从阴道口延伸到宫颈、富有弹性的肌性管道；阴蒂的大部分结构位于身体内部。</Text>
        <Text selectable style={styles.body}>阴唇长度、左右不对称和颜色差异可能属于常见个体差异。</Text>
        <Text selectable style={styles.body}>持续疼痛、瘙痒、灼热、破损、肿块、异常分泌物或明显新变化时可咨询医疗专业人员。</Text>
      </InfoCard>

      <Card accessible={false} testID="body-diagram-card" variant="muted">
        <SecondaryButton ref={diagramTriggerRef} label="查看外阴结构图" onPress={() => setConsentOpen(true)} />
        <Text style={styles.secondary}>可选，不查看也可以继续</Text>
        {diagramOpen ? (
          <View style={styles.diagram}>
            {diagramSource ? (
              <>
                {imageError ? (
                  <View style={styles.imageError}>
                    <Text accessibilityRole="alert" style={styles.error}>身体图加载失败，请重试。</Text>
                    <SecondaryButton label="重试加载身体图" onPress={() => {
                      setImageError(false);
                      setImageStatus("");
                      setImageAttempt((attempt) => attempt + 1);
                    }} />
                  </View>
                ) : (
                  <ScrollView
                    contentContainerStyle={styles.imageZoomContent}
                    horizontal
                    maximumZoomScale={2}
                    minimumZoomScale={1}
                    onScroll={(event) => setDiagramZoom(event.nativeEvent.zoomScale)}
                    pinchGestureEnabled
                    style={styles.imageViewport}
                    testID="body-diagram-viewport"
                    zoomScale={diagramZoom}
                  >
                    <Image
                      accessibilityLabel="医学图审核稿：阴阜、大阴唇、阴蒂、小阴唇、尿道口、阴道口、肛门"
                      accessibilityRole="image"
                      accessibilityValue={{ max: 200, min: 100, now: zoomPercent, text: `${zoomPercent}%` }}
                      key={imageAttempt}
                      onError={() => setImageError(true)}
                      onLoad={() => setImageStatus("身体图已加载")}
                      resizeMode="contain"
                      source={diagramSource}
                      style={styles.image}
                    />
                  </ScrollView>
                )}
                {imageStatus ? <Text accessibilityLiveRegion="polite" style={styles.paperBody}>{imageStatus}</Text> : null}
                <Text accessibilityLiveRegion="polite" selectable style={styles.paperBody}>
                  {`当前缩放：${zoomPercent}%`}
                </Text>
                <View accessibilityLabel="身体图缩放控制" style={styles.zoomControls}>
                  <SecondaryButton
                    disabled={diagramZoom >= 2}
                    label="放大身体图"
                    onPress={() => setDiagramZoom((current) => Math.min(2, current + 0.25))}
                  />
                  <SecondaryButton
                    disabled={diagramZoom <= 1}
                    label="缩小身体图"
                    onPress={() => setDiagramZoom((current) => Math.max(1, current - 0.25))}
                  />
                  <TextAction
                    disabled={diagramZoom === 1}
                    label="重置身体图缩放"
                    onPress={() => setDiagramZoom(1)}
                  />
                </View>
              </>
            ) : null}
            <Text style={styles.reviewLabel}>医学图审核稿</Text>
          </View>
        ) : null}
      </Card>

      {diagramOpen ? (
        <InfoCard testID="body-supplemental-knowledge" title="补充知识" variant="medical">
          <Text selectable style={styles.body}>每个人的外阴外观都不相同。阴唇左右不完全对称、其中一侧更长，或颜色与周围皮肤、另一侧不完全一致，都可能属于常见的正常差异。外阴颜色也会因个体肤色、激素等因素有所不同；不能仅凭颜色或是否发生过摩擦判断健康状况。</Text>
          <Text selectable style={styles.body}>如果较长的一侧因衣物、运动或其他摩擦带来持续不适，或者出现持续疼痛、瘙痒、灼热、破损、肿块、异常分泌物或明显的新变化，可以咨询妇科或其他合适的医疗专业人员。即使没有这些情况，只要{addressPreference}仍然担心，也可以就医。就诊前可以询问是否能安排女性医生；在医疗机构允许的情况下，也可以请一位信任的人陪同。具体以医疗机构安排为准。</Text>
        </InfoCard>
      ) : null}

      <InfoCard
        testID="body-sexual-activity-definition"
        title={definition.title}
        variant="education"
      >
        <Text selectable style={styles.body}>{definition.intro}</Text>
        <View accessibilityRole="list" style={styles.exampleList}>
          {definition.examples.map((example) => (
            <View key={example} style={styles.exampleRow}>
              <Text aria-hidden style={styles.bullet}>•</Text>
              <Text selectable style={styles.exampleText}>{example}</Text>
            </View>
          ))}
        </View>
        <Text selectable style={styles.conclusion}>{definition.conclusion}</Text>
      </InfoCard>

      {sortedCards.map((card) => (
        <InfoCard key={card.id} testID={`body-knowledge-card-${card.id}`} title={card.title} variant="medical">
          <Text selectable style={styles.body}>{card.body}</Text>
        </InfoCard>
      ))}

      <InfoCard title={`身体提供感受，决定仍然属于${addressPreference}。`} variant="pause" />
      <TextAction
        accessibilityLabel="打开内界官网信息来源"
        label="查看完整信息来源"
        onPress={() => { void onOpenSources?.(); }}
        underlined
      />
      <JourneyAction
        errorMessage="暂时无法继续，请重试。"
        label="看看我对过夜的期待"
        loadingLabel="正在继续…"
        onAction={complete}
      />

      <BottomSheet
        onClose={() => setConsentOpen(false)}
        reducedMotion={reducedMotion}
        returnFocusRef={diagramTriggerRef}
        title="查看外阴结构图前"
        visible={consentOpen}
      >
        <Text style={styles.body}>接下来会显示外阴结构的医学审核图。是否现在查看？</Text>
        <JourneyAction
          errorMessage="身体图暂时无法打开，请重试。"
          label="我愿意查看"
          loadingLabel="正在记录查看选择…"
          onAction={revealDiagram}
        />
        <TextAction label="暂时不看" onPress={() => setConsentOpen(false)} />
      </BottomSheet>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return {
  page: { flexGrow: 1, gap: theme.space.xl, minWidth: 0 },
  title: { ...theme.typography.title, color: theme.color.text, flexShrink: 1 },
  body: { ...theme.typography.body, color: theme.color.text, flexShrink: 1 },
  secondary: { ...theme.typography.caption, color: theme.color.textSecondary, flexShrink: 1 },
  exampleList: { gap: theme.space.compact },
  exampleRow: { alignItems: "flex-start" as const, flexDirection: "row" as const, gap: theme.space.sm },
  bullet: { ...theme.typography.body, color: theme.color.infoMuted },
  exampleText: { ...theme.typography.body, color: theme.color.text, flex: 1, flexShrink: 1 },
  conclusion: { ...theme.typography.body, color: theme.color.text, flexShrink: 1 },
  diagram: {
    backgroundColor: theme.color.paperCanvas,
    borderRadius: theme.radius.feature,
    gap: theme.space.md,
    padding: theme.space.card,
  },
  paperBody: { ...theme.typography.body, color: theme.color.paperText, flexShrink: 1 },
  reviewLabel: { ...theme.typography.label, color: theme.color.paperSecondary },
  imageViewport: {
    aspectRatio: 1,
    maxHeight: 480,
    overflow: "hidden" as const,
    width: "100%" as const,
  },
  imageZoomContent: { flexGrow: 1 },
  image: { height: "100%" as const, width: "100%" as const },
  imageError: { gap: theme.space.compact },
  error: { ...theme.typography.body, color: theme.color.error, flexShrink: 1 },
  zoomControls: { gap: theme.space.compact, width: "100%" as const },
  };
}

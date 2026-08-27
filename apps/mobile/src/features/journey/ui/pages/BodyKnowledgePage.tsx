import type { JourneyKnowledgeCard, JourneySource } from "@cave/content";
import { useMemo, useState } from "react";
import { Image, type ImageSourcePropType, Text, View } from "react-native";

import { theme } from "../../../../core/design/theme";
import { BottomSheet } from "../../../../core/ui/bottom-sheet";
import { Button } from "../../../../core/ui/Button";
import { Card } from "../../../../core/ui/Card";
import { InfoCard } from "../../../../core/ui/info-card";
import { SecondaryButton } from "../../../../core/ui/secondary-button";
import { SourceDrawer } from "../../../../core/ui/source-drawer";
import { TextAction } from "../../../../core/ui/text-action";
import { JourneyAction } from "../components/JourneyAction";

type ActionResult = void | Promise<void>;

export type BodyKnowledgePageProps = {
  cards: JourneyKnowledgeCard[];
  sources: JourneySource[];
  onContinue: () => ActionResult;
  onRead?: (id: string) => ActionResult;
  onOpenDiagram?: () => ActionResult;
  onSourceAction?: (source: JourneySource) => ActionResult;
  diagramSource?: ImageSourcePropType;
  addressPreference?: "你" | "妳";
  reducedMotion?: boolean;
};

export function BodyKnowledgePage({
  cards,
  sources,
  onContinue,
  onRead,
  onOpenDiagram,
  onSourceAction,
  diagramSource,
  addressPreference = "你",
  reducedMotion = false,
}: BodyKnowledgePageProps) {
  const sortedCards = [...cards].sort((a, b) => a.order - b.order).slice(0, 3);
  const relevantSources = useMemo(() => {
    const ids = new Set(sortedCards.flatMap((card) => card.sourceIds));
    ids.add("SRC-004");
    return sources.filter((source) => ids.has(source.id));
  }, [sortedCards, sources]);
  const [consentOpen, setConsentOpen] = useState(false);
  const [diagramOpen, setDiagramOpen] = useState(false);
  const [source, setSource] = useState<JourneySource | null>(null);

  const complete = async () => {
    for (const card of sortedCards) await onRead?.(card.id);
    await onContinue();
  };

  const revealDiagram = () => {
    setConsentOpen(false);
    setDiagramOpen(true);
    void onOpenDiagram?.();
  };

  return (
    <View style={styles.page} testID="page-3-content">
      <Text accessibilityRole="header" style={styles.title}>身体会回应，决定仍属于{addressPreference}</Text>
      <Text style={styles.body}>认识身体，不是为了找到一条必须走完的路线。它帮助{addressPreference}分清身体正在发生什么，以及自己是否愿意。</Text>

      {sortedCards.map((card) => (
        <InfoCard key={card.id} testID={`body-knowledge-card-${card.id}`} title={card.title} variant="medical">
          <Text selectable style={styles.body}>{card.body}</Text>
        </InfoCard>
      ))}

      <Card accessible={false} variant="muted">
        <SecondaryButton label="查看身体图" onPress={() => setConsentOpen(true)} />
        <Text style={styles.secondary}>可选，不查看也可以继续</Text>
        {diagramOpen ? (
          <View style={styles.diagram}>
            <Text style={styles.paperBody}>外阴是身体外部可见的区域；阴道是通向身体内部的管道。阴蒂也不只是外部可见的小点，它的大部分结构延伸在身体内部。</Text>
            {diagramSource ? (
              <Image
                accessibilityLabel="医学图审核稿：阴阜、大阴唇、阴蒂、小阴唇、尿道口、阴道口、肛门"
                resizeMode="contain"
                source={diagramSource}
                style={styles.image}
              />
            ) : null}
            <Text style={styles.reviewLabel}>医学图审核稿</Text>
            <View accessibilityRole="summary" style={styles.paperTip}>
              <Text style={styles.paperTitle}>温馨提示</Text>
              <Text style={styles.paperBody}>每个人的外阴外观都不相同。阴唇左右不完全对称、其中一侧更长，或颜色与周围皮肤、另一侧不完全一致，都可能属于常见的正常差异。外阴颜色也会因个体肤色、激素等因素有所不同；不能仅凭颜色或是否发生过摩擦判断健康状况。</Text>
              <Text style={styles.paperBody}>如果较长的一侧因衣物、运动或其他摩擦带来持续不适，或者出现持续疼痛、瘙痒、灼热、破损、肿块、异常分泌物或明显的新变化，可以咨询妇科或其他合适的医疗专业人员。即使没有这些情况，只要{addressPreference}仍然担心，也可以就医。就诊前可以询问是否能安排女性医生；在医疗机构允许的情况下，也可以请一位信任的人陪同。具体以医疗机构安排为准。</Text>
            </View>
          </View>
        ) : null}
      </Card>

      <InfoCard title={`身体提供感受，决定仍然属于${addressPreference}。`} variant="pause" />
      {relevantSources.length > 0 ? (
        <View style={styles.sources}>
          <TextAction
            label={`来源与医学说明 · ${relevantSources.length}`}
            onPress={() => setSource(relevantSources[0]!)}
            underlined
          />
          {relevantSources.map((item) => (
            <TextAction
              key={item.id}
              label={`查看来源：${item.organization}｜${item.title}`}
              onPress={() => setSource(item)}
            />
          ))}
        </View>
      ) : null}
      <JourneyAction
        errorMessage="暂时无法继续，请重试。"
        label="看看我对不同靠近的感觉"
        loadingLabel="正在继续…"
        onAction={complete}
      />

      <BottomSheet
        onClose={() => setConsentOpen(false)}
        reducedMotion={reducedMotion}
        title="查看身体图前"
        visible={consentOpen}
      >
        <Text style={styles.body}>接下来会显示外阴结构的医学审核图。是否现在查看？</Text>
        <Button label="我愿意查看" onPress={revealDiagram} />
        <TextAction label="暂时不看" onPress={() => setConsentOpen(false)} />
      </BottomSheet>

      {source ? (
        <SourceDrawer
          institution={source.organization}
          onAction={() => { void onSourceAction?.(source); }}
          onClose={() => setSource(null)}
          reducedMotion={reducedMotion}
          title={source.title}
          updatedAt={`${source.publicationOrReviewDate} · 访问于 ${source.accessedAt}`}
          visible
        />
      ) : null}
    </View>
  );
}

const styles = {
  page: { flexGrow: 1, gap: theme.space.xl, minWidth: 0 },
  title: { ...theme.typography.title, color: theme.color.text, flexShrink: 1 },
  body: { ...theme.typography.body, color: theme.color.text, flexShrink: 1 },
  secondary: { ...theme.typography.caption, color: theme.color.textSecondary, flexShrink: 1 },
  sources: { alignItems: "flex-start" as const, gap: theme.space.sm },
  diagram: {
    backgroundColor: theme.color.paperCanvas,
    borderRadius: theme.radius.feature,
    gap: theme.space.md,
    padding: theme.space.card,
  },
  paperBody: { ...theme.typography.body, color: theme.color.paperText, flexShrink: 1 },
  paperTitle: { ...theme.typography.cardTitle, color: theme.color.paperText, flexShrink: 1 },
  paperTip: {
    borderColor: theme.color.brandDeep,
    borderCurve: "continuous" as const,
    borderRadius: theme.radius.control,
    borderWidth: theme.border.width,
    gap: theme.space.compact,
    padding: theme.space.md,
  },
  reviewLabel: { ...theme.typography.label, color: theme.color.paperSecondary },
  image: { aspectRatio: 1, maxHeight: 480, width: "100%" as const },
};

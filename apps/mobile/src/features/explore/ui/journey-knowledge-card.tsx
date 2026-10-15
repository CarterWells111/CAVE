import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { TextAction } from "../../../core/ui/text-action";
import type { SamplePage } from "../catalog";

type KnowledgeCard = NonNullable<SamplePage["cards"]>[number];

export function JourneyKnowledgeCard({ card, onOpenSource }: {
  card: KnowledgeCard;
  onOpenSource(url: string): void;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={{
      backgroundColor: theme.color.surface,
      borderColor: theme.color.borderSoft,
      borderRadius: theme.radius.control,
      borderWidth: theme.border.width,
      overflow: "hidden",
    }}>
      <Pressable
        accessibilityLabel={`${card.title}${card.tag ? `，${card.tag}` : ""}，${expanded ? "收起" : "展开"}`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        style={({ pressed }) => ({
          alignItems: "center",
          backgroundColor: pressed ? theme.color.surfacePressed : theme.color.surface,
          flexDirection: "row",
          justifyContent: "space-between",
          minHeight: theme.size.minimumTouchTarget,
          padding: theme.space.md,
        })}
      >
        <Text style={{ ...theme.typography.cardTitle, color: theme.color.text, flex: 1 }}>
          {card.title}{card.tag ? ` · ${card.tag}` : ""}
        </Text>
        <Text style={{ ...theme.typography.label, color: theme.color.primary }}>{expanded ? "收起 −" : "展开 +"}</Text>
      </Pressable>
      {expanded ? (
        <View style={{ gap: theme.space.sm, paddingHorizontal: theme.space.md, paddingBottom: theme.space.md }}>
          <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>{card.body}</Text>
          {card.source ? <TextAction label={card.source.label} onPress={() => onOpenSource(card.source!.url)} underlined /> : null}
        </View>
      ) : null}
    </View>
  );
}

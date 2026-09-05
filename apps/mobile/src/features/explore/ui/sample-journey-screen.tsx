import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { BackHandler, Text, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { ProgressHeader } from "../../../core/ui/ProgressHeader";
import { Screen } from "../../../core/ui/Screen";
import type { SampleJourney } from "../catalog";

type SampleJourneyScreenProps = {
  journey: SampleJourney;
  onExit: () => void;
};

function SampleJourneyPages({ journey, onExit }: SampleJourneyScreenProps) {
  const theme = useTheme();
  const [pageIndex, setPageIndex] = useState(0);
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
            样板 · 框架预览
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
          <Text accessibilityRole="header" selectable style={{ ...theme.typography.title, color: theme.color.text, flexShrink: 1 }}>
            {page.title}
          </Text>
          <Text selectable style={{ ...theme.typography.body, color: theme.color.text, flexShrink: 1 }}>
            {page.body}
          </Text>
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

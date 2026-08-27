import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { JOURNEY_PAGE_IDS } from "../application/journey-navigation";
import type { JourneyPageId } from "../domain/types";
import type { JourneyRuntimeNotice } from "./journey-ui-contracts";
import { journeyColors, journeySizes, journeySpacing } from "./journey-ui-tokens";
import { JourneyStatusBanner } from "./components/JourneyStatusBanner";

const JOURNEY_PAGE_TITLES: Record<JourneyPageId, string> = {
  welcome: "欢迎来到内界 CAVE",
  overnight: "过夜期待与在意",
  "body-knowledge": "身体与安全知识",
  "behavior-attitudes": "行为态度与边界",
  reflection: "自我反思",
  "preset-practice": "预设沟通练习",
  checklist: "行前检查清单",
  "communication-card": "沟通卡片"
};

type Props = PropsWithChildren<{
  pageId: JourneyPageId;
  onBack?: () => void;
  runtimeNotice?: JourneyRuntimeNotice;
}>;

export function JourneyScreenShell({ pageId, onBack, runtimeNotice, children }: Props) {
  const pageNumber = JOURNEY_PAGE_IDS.indexOf(pageId) + 1;
  return (
    <View style={styles.screen} testID={`journey-page-${pageId}`}>
      <SafeAreaView style={styles.safeArea} testID="journey-safe-area">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardAvoiding}
          testID="journey-keyboard-avoiding"
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            testID="journey-scroll"
          >
            <View style={styles.header}>
              <Text style={styles.progress}>{`第 ${pageNumber} 页，共 8 页`}</Text>
              {pageNumber > 1 ? (
                <Pressable
                  accessibilityLabel="返回上一页"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !onBack }}
                  disabled={!onBack}
                  onPress={onBack}
                  style={styles.backTarget}
                  testID="journey-back"
                >
                  <Text style={styles.backLabel}>返回修改</Text>
                </Pressable>
              ) : (
                <View
                  style={styles.backTarget}
                  testID="journey-back-placeholder"
                />
              )}
              <Text accessibilityRole="header" style={styles.title}>
                {JOURNEY_PAGE_TITLES[pageId]}
              </Text>
            </View>
            {runtimeNotice ? (
              <JourneyStatusBanner
                accessibilityLabel={runtimeNotice.accessibilityLabel}
                message={runtimeNotice.message}
              />
            ) : null}
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: journeyColors.background, flex: 1 },
  safeArea: { flex: 1 },
  keyboardAvoiding: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    gap: journeySpacing.md,
    paddingBottom: journeySpacing.xl,
    paddingHorizontal: journeySpacing.lg,
    paddingTop: journeySpacing.md
  },
  header: { gap: journeySpacing.sm },
  progress: { color: journeyColors.mutedText, fontSize: 14, lineHeight: 20 },
  backTarget: {
    alignItems: "flex-start",
    justifyContent: "center",
    minHeight: journeySizes.minimumTouchTarget,
    minWidth: journeySizes.minimumTouchTarget,
    paddingVertical: journeySpacing.sm
  },
  backLabel: { color: journeyColors.text, fontSize: 16, lineHeight: 22 },
  title: {
    color: journeyColors.text,
    fontSize: 24,
    fontWeight: "600",
    lineHeight: 32
  }
});

import { useRef, useState } from "react";
import { Text, View } from "react-native";

import { useTheme } from "../../../../core/design/theme-provider";
import type { AppTheme } from "../../../../core/design/theme";
import { BottomSheet } from "../../../../core/ui/bottom-sheet";
import { Button } from "../../../../core/ui/Button";
import { Card } from "../../../../core/ui/Card";
import { EchoBackground } from "../../../../core/ui/echo-background";
import { IconTextAction } from "../../../../core/ui/icon-text-action";
import type { FirstRunBrandLayout } from "../first-run-layout";

type ActionResult = void | Promise<void>;

export type WelcomePageProps = {
  brandPaddingTop?: number;
  layout?: FirstRunBrandLayout;
  onStart: () => ActionResult;
  onOpenSettings?: (() => ActionResult) | undefined;
  resumeAvailable: boolean;
  onResume?: () => ActionResult;
  reducedMotion?: boolean;
};

export function WelcomePage({
  brandPaddingTop,
  layout = "stacked",
  onStart,
  onOpenSettings,
  resumeAvailable,
  onResume,
  reducedMotion,
}: WelcomePageProps) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpReturnFocusRef = useRef<View>(null);
  const primaryAction = resumeAvailable && onResume ? onResume : onStart;

  return (
    <View style={styles.page} testID="welcome-landing">
      <EchoBackground reducedMotion={reducedMotion} />
      <View style={styles.headerActions}>
        {onOpenSettings ? (
          <IconTextAction icon="settings-outline" label="设置" onPress={() => { void onOpenSettings(); }} />
        ) : null}
        <IconTextAction ref={helpReturnFocusRef} icon="help-circle-outline" label="帮助" onPress={() => setHelpOpen(true)} />
      </View>
      <View
        style={[styles.brand, brandPaddingTop === undefined ? null : { paddingTop: brandPaddingTop }]}
        testID="welcome-brand"
      >
        <Text style={styles.eyebrow}>Consent · Awareness · Voice · Exploration</Text>
        <View
          style={[styles.brandNames, layout === "inline-brand" ? styles.inlineBrandNames : null]}
          testID="welcome-brand-names"
        >
          <Text accessibilityRole="header" style={styles.cave}>CAVE</Text>
          <Text style={styles.chineseBrand}>内界</Text>
        </View>
      </View>
      <Card testID="welcome-intro-card" variant="accent">
        <Text selectable style={styles.heading}>探索那些隐于沉默、未被好好说清的事。</Text>
        <Text selectable style={styles.body}>循着内心的回响，找到属于自己的靠近方式。</Text>
        <Text selectable style={styles.reassurance}>期待、紧张和犹豫，可以同时存在。</Text>
      </Card>
      <View style={styles.actions} testID="welcome-actions">
        <Button
          label={resumeAvailable && onResume ? "继续旅程" : "开启旅程"}
          onPress={() => { void primaryAction(); }}
        />
      </View>

      <BottomSheet
        onClose={() => setHelpOpen(false)}
        reducedMotion={reducedMotion}
        returnFocusRef={helpReturnFocusRef}
        title="关于内界 CAVE"
        visible={helpOpen}
      >
        <Text selectable style={styles.body}>内界 CAVE 帮助你探索亲密关系中的身体、安全、边界与沟通。</Text>
        <Text selectable style={styles.body}>点击“开启旅程”后，会先请你在本机作出年满 18 岁的自我声明。声明后，会先看到“开始前，想告诉你”，再自由选择旅程。六段旅程目前提供框架预览，也可以单独体验“第一次过夜”。</Text>
        <Text selectable style={styles.body}>这项声明不是身份核验，也不是真实年龄核验；我们不收集生日、证件或邮箱。</Text>
        <Text selectable style={styles.body}>它是自我探索与沟通练习工具，不提供医疗诊断，也不能替代专业医疗或紧急支持。</Text>
        <Text selectable style={styles.body}>部分页面内容由 AI 辅助生成，并经团队编辑审核。AI 辅助、团队编辑审核和免责声明都不能代替医疗、安全及紧急支持内容所需的专业审核。</Text>
        <Text selectable style={styles.body}>旅程记录以本机保存为先，不同步到云端。删除 App 或清除本机数据后，内容可能无法恢复。</Text>
      </BottomSheet>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return {
  page: { flexGrow: 1, gap: theme.space.lg, minWidth: 0, position: "relative" as const },
  headerActions: {
    alignItems: "center" as const,
    alignSelf: "stretch" as const,
    flexDirection: "row" as const,
    gap: theme.space.xs,
    justifyContent: "flex-end" as const,
  },
  brand: { alignItems: "center" as const, gap: theme.space.xs, paddingTop: theme.space.card },
  brandNames: { alignItems: "center" as const, gap: theme.space.xs },
  inlineBrandNames: {
    flexDirection: "row" as const,
    gap: theme.space.md,
  },
  eyebrow: { ...theme.typography.numericLabel, color: theme.color.textSecondary, flexShrink: 1, textAlign: "center" as const },
  cave: { ...theme.typography.brandEnglish, color: theme.color.text, letterSpacing: 5.28 },
  chineseBrand: { ...theme.typography.brandChinese, color: theme.color.text },
  heading: { ...theme.typography.heading, color: theme.color.text, flexShrink: 1 },
  body: { ...theme.typography.body, color: theme.color.text, flexShrink: 1 },
  reassurance: { ...theme.typography.cardTitle, color: theme.color.lightWarm, flexShrink: 1 },
  actions: { gap: theme.space.compact },
  };
}

import { View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Card } from "../../../core/ui/Card";
import { EmptyState } from "../../../core/ui/EmptyState";
import { ErrorState } from "../../../core/ui/ErrorState";
import { StatusBanner } from "../../../core/ui/StatusBanner";
import {
  SectionHeading,
  ShellFrame,
  ShellLoading,
  SupportingText,
  type ShellLoadState,
} from "./shell-ui-components";

type Scenario = { id: string; title: string; statusLabel: string };

type Props = {
  loadState?: ShellLoadState;
  scenarios: Scenario[];
  onRetry?: () => void;
  onStartPhrase?: (phrase: string) => void;
  onStartPractice: () => void;
  onStartScenario: (id: string) => void;
  recentPhrase?: string;
};

export function PracticeHubScreen({ loadState = "ready", onRetry, onStartPhrase, onStartPractice, onStartScenario, recentPhrase, scenarios }: Props) {
  const theme = useTheme();
  return (
    <ShellFrame title="练习">
      <StatusBanner message="预设对话，不使用 AI" variant="info" />
      <SupportingText>所有分支都已写在本机内容中，不会生成对话，也不会录音。</SupportingText>
      {recentPhrase && onStartPhrase ? (
        <Card accessible={false}>
          <SectionHeading>来自刚完成的旅程</SectionHeading>
          <SupportingText>{recentPhrase}</SupportingText>
          <Button label="用这句话排练" onPress={() => onStartPhrase(recentPhrase)} />
        </Card>
      ) : null}
      {loadState === "loading" ? <ShellLoading /> : null}
      {loadState === "error" ? (
        <ErrorState
          actionLabel="重试"
          message="暂时无法读取本机预设情境。"
          title="读取失败"
          {...(onRetry ? { onAction: onRetry } : {})}
        />
      ) : null}
      {loadState === "ready" ? (
        <View style={{ gap: theme.space.md }}>
          <SectionHeading>选择一个情境</SectionHeading>
          {scenarios.length > 0 ? scenarios.map((scenario) => (
            <Card accessible={false} key={scenario.id}>
              <SectionHeading>{scenario.title}</SectionHeading>
              <SupportingText>{scenario.statusLabel}</SupportingText>
              <Button label={`开始${scenario.title}`} onPress={() => onStartScenario(scenario.id)} />
            </Card>
          )) : (
            <EmptyState actionLabel="开始通用预设练习" message="仍可进入通用的本机预设练习。" onAction={onStartPractice} title="没有可用的预设情境" />
          )}
        </View>
      ) : null}
    </ShellFrame>
  );
}

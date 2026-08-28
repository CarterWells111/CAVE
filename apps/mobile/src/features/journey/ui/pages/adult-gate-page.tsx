import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { useTheme } from "../../../../core/design/theme-provider";
import { Card } from "../../../../core/ui/Card";
import { JourneyAction } from "../components/JourneyAction";

type AdultGatePageProps = {
  onConfirmAdult(): void | Promise<void>;
  onUnderage(): void | Promise<void>;
};

export function AdultGatePage({ onConfirmAdult, onUnderage }: AdultGatePageProps) {
  const theme = useTheme();
  const mountedRef = useRef(true);
  const decisionInFlightRef = useRef(false);
  const [pendingDecision, setPendingDecision] = useState<"adult" | "underage" | null>(null);

  useEffect(() => () => {
    mountedRef.current = false;
    decisionInFlightRef.current = false;
  }, []);

  const runDecision = async (
    decision: "adult" | "underage",
    action: () => void | Promise<void>
  ) => {
    if (decisionInFlightRef.current) return;
    decisionInFlightRef.current = true;
    setPendingDecision(decision);
    try {
      await action();
    } finally {
      decisionInFlightRef.current = false;
      if (mountedRef.current) setPendingDecision(null);
    }
  };

  return (
    <View style={{ gap: theme.space.lg }} testID="adult-gate">
      <Card variant="accent">
        <Text accessibilityRole="header" style={{ ...theme.typography.title, color: theme.color.text }}>
          仅限已满 18 岁者
        </Text>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>
          继续即表示你在本机作出自我声明：你已年满 18 岁。这不是身份或年龄核验。
        </Text>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>
          我们不收集你的生日、证件或邮箱。你的数据本机优先保存。
        </Text>
      </Card>
      <JourneyAction
        disabled={pendingDecision !== null}
        errorMessage="确认暂时无法保存，请重试。"
        label="我已年满 18 岁，继续"
        loadingLabel="正在继续…"
        onAction={() => runDecision("adult", onConfirmAdult)}
      />
      <JourneyAction
        disabled={pendingDecision !== null}
        errorMessage="暂时无法继续，请重试。"
        label="我未满 18 岁"
        loadingLabel="正在继续…"
        onAction={() => runDecision("underage", onUnderage)}
      />
    </View>
  );
}

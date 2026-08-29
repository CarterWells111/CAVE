import { useState } from "react";
import { Text, View } from "react-native";

import { useTheme } from "../../../../core/design/theme-provider";
import { Card } from "../../../../core/ui/Card";
import { ChoiceChip } from "../../../../core/ui/ChoiceChip";
import type { AddressPreference } from "../../domain/types";
import { JourneyAction } from "../components/JourneyAction";

type SelectedAddressPreference = Exclude<AddressPreference, null>;

export function PrefacePage({
  onContinue,
}: {
  onContinue(preference: SelectedAddressPreference): void | Promise<void>;
}) {
  const theme = useTheme();
  const [preference, setPreference] = useState<SelectedAddressPreference | null>(null);
  const addressed = preference ?? "你";
  return (
    <View style={{ gap: theme.space.lg }} testID="journey-preface">
      <Card variant="accent">
        <Text accessibilityRole="header" style={{ ...theme.typography.title, color: theme.color.text }}>
          开始前，想告诉你
        </Text>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>
          身体的反应、好奇、不适与犹豫都可能同时存在。界面不会替{addressed}下结论，只提供认识身体、同意与表达的起点。
        </Text>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>
          先选一个希望在这次旅程中看到的称呼；它只改变界面文字，不会改变你填写的内容。
        </Text>
      </Card>
      <View style={{ gap: theme.space.compact }}>
        <ChoiceChip label="你｜日常、自然，不限定性别。" onPress={() => setPreference("你")} selected={preference === "你"} semantics="radio" />
        <ChoiceChip label="妳｜明确称呼女性，更有书信感。" onPress={() => setPreference("妳")} selected={preference === "妳"} semantics="radio" />
      </View>
      <JourneyAction
        disabled={preference === null}
        errorMessage="称呼暂时无法保存，请重试。"
        label="这样称呼我"
        loadingLabel="正在保存称呼…"
        onAction={() => preference === null ? undefined : onContinue(preference)}
      />
    </View>
  );
}

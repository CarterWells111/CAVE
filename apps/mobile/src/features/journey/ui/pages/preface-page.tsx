import { useRef, useState } from "react";
import { Text, View } from "react-native";

import { useTheme } from "../../../../core/design/theme-provider";
import { Card } from "../../../../core/ui/Card";
import { ChoiceChip } from "../../../../core/ui/ChoiceChip";
import type { AddressPreference } from "../../domain/types";
import { JourneyAction } from "../components/JourneyAction";
import { JourneyScrollTarget, useJourneyGuidedScroll } from "../guided-scroll-screen";
import { LoginSaveHint, PreferenceSyncNotice } from "../../../account/ui/PreferenceSyncNotice";

type SelectedAddressPreference = Exclude<AddressPreference, null>;

export function PrefacePage({
  onContinue,
  initialPreference = null,
  onChoose,
  onSignIn,
}: {
  onContinue(preference: SelectedAddressPreference): void | Promise<void>;
  initialPreference?: SelectedAddressPreference | null;
  onChoose?: ((preference: SelectedAddressPreference) => Promise<void>) | undefined;
  onSignIn?: (() => void) | undefined;
}) {
  const theme = useTheme();
  const { reveal } = useJourneyGuidedScroll();
  const [preference, setPreference] = useState<SelectedAddressPreference | null>(initialPreference);
  const [saveError, setSaveError] = useState(false);
  const savingRef = useRef<Promise<void>>(Promise.resolve());
  const [saving, setSaving] = useState(false);
  const preferenceAdvancedRef = useRef(false);
  const choosePreference = (nextPreference: SelectedAddressPreference) => {
    setPreference(nextPreference);
    setSaveError(false);
    if (onChoose !== undefined) {
      setSaving(true);
      const task = savingRef.current.catch(() => undefined).then(() => onChoose(nextPreference));
      savingRef.current = task;
      void task.then(() => { if (savingRef.current === task) setSaveError(false); }, () => { if (savingRef.current === task) setSaveError(true); })
        .finally(() => { if (savingRef.current === task) setSaving(false); });
    }
    if (!preferenceAdvancedRef.current) {
      preferenceAdvancedRef.current = true;
      reveal("preface-continue");
    }
  };
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
          选择希望在界面中看到的称呼，之后可在我的设置中调整。登录后会保存到账号；称呼只改变界面文字，不会改变你填写的内容。
        </Text>
      </Card>
      <View style={{ gap: theme.space.compact }}>
        <ChoiceChip label="你｜日常、自然，不限定性别。" onPress={() => choosePreference("你")} selected={preference === "你"} semantics="radio" />
        <ChoiceChip label="妳｜明确称呼女性，更有书信感。" onPress={() => choosePreference("妳")} selected={preference === "妳"} semantics="radio" />
      </View>
      <JourneyScrollTarget targetId="preface-continue">
        <JourneyAction
          disabled={preference === null || saving}
          errorMessage="称呼暂时无法保存，请重试。"
          label="这样称呼我"
          loadingLabel="正在保存称呼…"
          onAction={async () => {
            if (preference === null) return;
            if (saveError && onChoose !== undefined) await onChoose(preference);
            await onContinue(preference);
          }}
        />
      </JourneyScrollTarget>
      {saveError ? <Text accessibilityRole="alert" style={{ ...theme.typography.caption, color: theme.color.error }}>称呼暂时无法保存，请重试。</Text> : null}
      <LoginSaveHint disabled={saving || saveError} onPress={onSignIn} />
      <PreferenceSyncNotice />
    </View>
  );
}

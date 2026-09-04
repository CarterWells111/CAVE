import { useState } from "react";
import { Text, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Card } from "../../../core/ui/Card";
import { ChoiceChip } from "../../../core/ui/ChoiceChip";
import { Button } from "../../../core/ui/Button";
import { useOptionalAccountPreferences } from "../runtime/AccountPreferencesProvider";
import { PreferenceSyncNotice } from "./PreferenceSyncNotice";

export function AccountPreferenceSettings({ onRevoke }: { onRevoke(): void }) {
  const preferences = useOptionalAccountPreferences();
  const theme = useTheme();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  if (preferences === null) return null;
  const change = async (patch: Parameters<typeof preferences.change>[0]) => {
    if (saving) return;
    setSaving(true);
    setError(false);
    try {
      await preferences.change(patch);
      if (patch.ageConfirmed === false) onRevoke();
    } catch { setError(true); }
    finally { setSaving(false); }
  };
  return <Card accessible={false}>
    <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text }}>成年确认与称呼</Text>
    <Text style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
      {preferences.owner === null ? "选择保存在本机，登录后可保存到账号。" : "选择与账号绑定，可随时在这里调整。"}
    </Text>
    {preferences.ready ? <>
      <Text style={{ ...theme.typography.body, color: theme.color.text }}>成年确认：{preferences.preferences.ageConfirmed ? "已确认年满 18 岁" : "尚未确认"}</Text>
      <Button label={preferences.preferences.ageConfirmed ? "撤销成年确认" : "我已年满 18 岁，确认"} disabled={saving} onPress={() => { void change({ ageConfirmed: !preferences.preferences.ageConfirmed }); }} />
      <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>撤销后需重新确认才能继续旅程，已有内容会保留。</Text>
      <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text }}>界面称呼</Text>
      <View style={{ gap: theme.space.sm }}>
        {(["你", "妳"] as const).map((value) => <ChoiceChip key={value} label={value} selected={preferences.preferences.addressPreference === value} disabled={saving} semantics="radio" onPress={() => { void change({ addressPreference: value }); }} />)}
      </View>
    </> : <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>正在读取设置…</Text>}
    {error ? <Text accessibilityRole="alert" style={{ ...theme.typography.caption, color: theme.color.error }}>设置暂时无法保存，请重试。</Text> : null}
    <PreferenceSyncNotice />
  </Card>;
}

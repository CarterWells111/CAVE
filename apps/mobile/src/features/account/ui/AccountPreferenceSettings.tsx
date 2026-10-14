import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../../core/design/theme-provider";
import { BottomSheet } from "../../../core/ui/bottom-sheet";
import { SelectionField } from "../../../core/ui/selection-field";
import { Button } from "../../../core/ui/Button";
import { TextAction } from "../../../core/ui/text-action";
import { useOptionalAccountPreferences } from "../runtime/AccountPreferencesProvider";
import { PreferenceSyncNotice } from "./PreferenceSyncNotice";

export function AccountPreferenceSettings({ onRevoke }: { onRevoke(): void }) {
  const preferences = useOptionalAccountPreferences();
  const theme = useTheme();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [adultOpen, setAdultOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const trigger = useRef<View>(null);
  const inFlight = useRef(false);
  if (preferences === null) return null;
  const change = async (patch: Parameters<typeof preferences.change>[0]) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError(false);
    try {
      await preferences.change(patch);
      setAdultOpen(false);
      if (patch.ageConfirmed === false) onRevoke();
    } catch {
      setError(true);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  const adultValue = preferences.ready
    ? preferences.preferences.ageConfirmed
      ? "已确认年满 18 岁"
      : "尚未确认"
    : "正在读取设置…";
  return (
    <View style={{ gap: theme.space.sm }} testID="account-preference-rows">
      <Pressable
        ref={trigger}
        accessibilityRole="button"
        accessibilityLabel={`成年确认，${adultValue}`}
        accessibilityState={{
          disabled: !preferences.ready || saving,
          expanded: adultOpen,
        }}
        disabled={!preferences.ready || saving}
        onPress={() => {
          setError(false);
          setAdultOpen(true);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={({ pressed }) => ({
          backgroundColor: pressed
            ? theme.color.surfacePressed
            : theme.color.surface,
          borderRadius: theme.radius.md,
          minHeight: theme.size.minimumTouchTarget,
          padding: theme.space.md,
          flexDirection: "row",
          alignItems: "center",
          gap: theme.space.sm,
          outlineColor: theme.color.focus,
          outlineOffset: theme.border.focusOffset,
          outlineWidth: focused ? theme.border.focusWidth : 0,
        })}
      >
        <Text
          style={{
            ...theme.typography.caption,
            color: theme.color.textSecondary,
          }}
        >
          成年确认
        </Text>
        <Text
          style={{
            ...theme.typography.body,
            color: theme.color.text,
            flex: 1,
            textAlign: "right",
          }}
        >
          {adultValue} ▾
        </Text>
      </Pressable>
      <SelectionField
        label="界面称呼"
        value={preferences.preferences.addressPreference ?? "unset"}
        disabled={!preferences.ready || saving}
        options={[
          { value: "你", label: "你" },
          { value: "妳", label: "妳" },
        ]}
        onChange={(value) => {
          void change({ addressPreference: value === "unset" ? null : value });
        }}
      />
      {error && !adultOpen ? (
        <Text
          accessibilityRole="alert"
          style={{ ...theme.typography.caption, color: theme.color.error }}
        >
          设置暂时无法保存，请重试。
        </Text>
      ) : null}
      <PreferenceSyncNotice />
      <BottomSheet
        title="成年确认"
        visible={adultOpen}
        onClose={() => setAdultOpen(false)}
        dismissible={!saving}
        returnFocusRef={trigger}
      >
        <Text style={{ ...theme.typography.body, color: theme.color.text }}>
          {adultValue}
        </Text>
        <Text
          style={{ ...theme.typography.body, color: theme.color.textSecondary }}
        >
          {preferences.owner === null
            ? "选择保存在本机，登录后可保存到账号。"
            : "选择与账号绑定，可随时在这里调整。"}
        </Text>
        <Text
          style={{
            ...theme.typography.caption,
            color: theme.color.textSecondary,
          }}
        >
          撤销后需重新确认才能继续旅程，已有内容会保留。
        </Text>
        {error ? (
          <Text
            accessibilityRole="alert"
            style={{ ...theme.typography.caption, color: theme.color.error }}
          >
            设置暂时无法保存，请重试。
          </Text>
        ) : null}
        <Button
          label={
            preferences.preferences.ageConfirmed
              ? "撤销成年确认"
              : "我已年满 18 岁，确认"
          }
          loading={saving}
          onPress={() => {
            void change({
              ageConfirmed: !preferences.preferences.ageConfirmed,
            });
          }}
        />
        <TextAction
          label="取消"
          disabled={saving}
          onPress={() => setAdultOpen(false)}
        />
      </BottomSheet>
    </View>
  );
}

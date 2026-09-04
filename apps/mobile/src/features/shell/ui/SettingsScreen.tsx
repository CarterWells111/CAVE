import { Ionicons } from "@expo/vector-icons";
import { type ComponentProps, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import type { ResolvedTheme, ThemePreference } from "../../../core/design/theme";
import { Button } from "../../../core/ui/Button";
import { Card } from "../../../core/ui/Card";
import { InfoCard } from "../../../core/ui/info-card";
import { IconTextAction } from "../../../core/ui/icon-text-action";
import { SecondaryButton } from "../../../core/ui/secondary-button";
import { AccountProfileCard } from "../../account/ui/AccountProfileCard";
import { AccountPreferenceSettings } from "../../account/ui/AccountPreferenceSettings";

type DeleteCapability = {
  deleteAllData(): Promise<void>;
  onContinue(): void;
};

type AccountCapability = {
  status: "signedOut" | "loading" | "ready" | "error";
  email?: string;
  profile?: { displayName: string; avatarUri?: string };
  error?: "load" | "save" | "permission" | "picker" | null;
  onSignIn?(): void;
  onManageAccount?(): void;
  onRetry?(): void;
  chooseAvatar?(): Promise<void>;
  removeAvatar?(): Promise<void>;
  saveDisplayName?(value: string): Promise<void>;
};

type PrivacySettingsCapability = {
  changeJournalSaveNotice(enabled: boolean): Promise<void>;
  retry(): void;
  showLocalJournalSaveNotice: boolean;
  status: "loading" | "ready" | "error";
};

export type SettingsScreenProps = {
  account?: AccountCapability | undefined;
  appearancePreference: ThemePreference;
  appearanceSaving: boolean;
  deletion?: DeleteCapability | undefined;
  privacy?: PrivacySettingsCapability | undefined;
  resolvedTheme: ResolvedTheme;
  onAppearancePreferenceChange(preference: ThemePreference): Promise<void>;
  onBack(): void;
  onAdultRevoked?: (() => void) | undefined;
};

type DeleteState = "idle" | "confirming" | "deleting" | "error" | "success";

function AppearanceChoice({
  checked,
  detail,
  disabled,
  icon,
  label,
  onPress,
}: {
  checked: boolean;
  detail?: string;
  disabled: boolean;
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress(): void;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const accessibilityLabel = detail ? `${label}，${detail}` : label;
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radio"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: checked
          ? theme.color.surfaceAccent
          : pressed ? theme.color.surfacePressed : theme.color.surface,
        borderColor: checked ? theme.color.primary : theme.color.interactiveBorder,
        borderCurve: "continuous",
        borderRadius: theme.radius.control,
        borderWidth: checked ? theme.border.selectedWidth : theme.border.width,
        flexDirection: "row",
        gap: theme.space.md,
        minHeight: theme.size.primaryActionHeight,
        minWidth: theme.size.minimumTouchTarget,
        opacity: disabled ? 0.65 : 1,
        outlineColor: theme.color.focus,
        outlineOffset: theme.border.focusOffset,
        outlineWidth: focused ? theme.border.focusWidth : 0,
        paddingHorizontal: theme.space.md,
        paddingVertical: theme.space.compact,
        width: "100%",
      })}
    >
      <Ionicons accessible={false} color={checked ? theme.color.primary : theme.color.textSecondary} name={icon} size={theme.size.iconLarge} />
      <View style={{ flex: 1, gap: theme.space.xs }}>
        <Text style={{ ...theme.typography.button, color: theme.color.text }}>{label}</Text>
        {detail ? <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>{detail}</Text> : null}
      </View>
      {checked ? <Ionicons accessible={false} color={theme.color.primary} name="checkmark-circle" size={theme.size.iconLarge} /> : null}
    </Pressable>
  );
}

function DestructiveButton({
  label,
  loading = false,
  onPress
}: {
  label: string;
  loading?: boolean;
  onPress(): void;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: loading }}
      disabled={loading}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: pressed ? theme.color.surfacePressed : theme.color.dangerSurface,
        borderColor: theme.color.danger,
        borderCurve: "continuous",
        borderRadius: theme.radius.control,
        borderWidth: loading ? theme.border.selectedWidth : theme.border.width,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: theme.space.sm,
        justifyContent: "center",
        minHeight: theme.size.primaryActionHeight,
        minWidth: theme.size.minimumTouchTarget,
        outlineColor: theme.color.focus,
        outlineOffset: theme.border.focusOffset,
        outlineWidth: focused ? theme.border.focusWidth : 0,
        paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.compact,
        width: "100%"
      })}
    >
      <Text style={{ ...theme.typography.button, color: theme.color.onDanger, flexShrink: 1, textAlign: "center" }}>
        {label}
      </Text>
      {loading ? <Text style={{ ...theme.typography.caption, color: theme.color.onDanger }}>处理中</Text> : null}
    </Pressable>
  );
}

export function SettingsScreen({
  account,
  appearancePreference,
  appearanceSaving,
  deletion,
  onAppearancePreferenceChange,
  onBack,
  onAdultRevoked,
  privacy,
  resolvedTheme,
}: SettingsScreenProps) {
  const theme = useTheme();
  const [deleteState, setDeleteState] = useState<DeleteState>("idle");
  const [appearanceError, setAppearanceError] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [nicknameEditorOpen, setNicknameEditorOpen] = useState(false);
  const [nicknameError, setNicknameError] = useState<"invalid" | "save" | null>(null);
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [profileActionError, setProfileActionError] = useState(false);
  const [privacySaveState, setPrivacySaveState] = useState<"idle" | "saving" | "error">("idle");
  const deletionInFlight = useRef(false);

  const deleteAll = async () => {
    if (!deletion || deletionInFlight.current) return;
    deletionInFlight.current = true;
    setDeleteState("deleting");
    try {
      await deletion.deleteAllData();
      setDeleteState("success");
    } catch {
      setDeleteState("error");
    } finally {
      deletionInFlight.current = false;
    }
  };

  const changeAppearance = async (preference: ThemePreference) => {
    if (appearanceSaving || preference === appearancePreference) return;
    setAppearanceError(false);
    try {
      await onAppearancePreferenceChange(preference);
    } catch {
      setAppearanceError(true);
    }
  };

  const runProfileAction = async (action?: () => Promise<void>) => {
    if (action === undefined) return;
    setProfileActionError(false);
    try {
      await action();
    } catch {
      setProfileActionError(true);
    }
  };

  const openAvatarActions = () => {
    Alert.alert("更改头像", undefined, [
      { text: "从相册选择", onPress: () => { void runProfileAction(account?.chooseAvatar); } },
      { text: "恢复默认头像", onPress: () => { void runProfileAction(account?.removeAvatar); } },
      { text: "取消", style: "cancel" },
    ]);
  };

  const openNicknameEditor = () => {
    setNicknameDraft(account?.profile?.displayName ?? "");
    setNicknameError(null);
    setNicknameEditorOpen(true);
  };

  const saveNickname = async () => {
    if (nicknameSaving || account?.saveDisplayName === undefined) return;
    const trimmed = nicknameDraft.trim();
    const length = Array.from(trimmed).length;
    if (length < 1 || length > 24) {
      setNicknameError("invalid");
      return;
    }
    setNicknameError(null);
    setNicknameSaving(true);
    try {
      await account.saveDisplayName(trimmed);
      setNicknameEditorOpen(false);
    } catch {
      setNicknameError("save");
    } finally {
      setNicknameSaving(false);
    }
  };

  const changeJournalSaveNotice = async (enabled: boolean) => {
    if (!privacy || privacySaveState === "saving") return;
    setPrivacySaveState("saving");
    try {
      await privacy.changeJournalSaveNotice(enabled);
      setPrivacySaveState("idle");
    } catch {
      setPrivacySaveState("error");
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{
        alignSelf: "center",
        gap: theme.space.xl,
        maxWidth: theme.size.readableContentMax,
        paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.xl,
        width: "100%"
      }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: theme.color.background, flex: 1 }}
      testID="settings-scroll"
    >
      <IconTextAction icon="arrow-back" label="返回" onPress={onBack} />
      <View style={{ gap: theme.space.sm }}>
        <Text accessibilityRole="header" selectable style={{ ...theme.typography.title, color: theme.color.text }}>
          设置
        </Text>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
          管理账户、保存方式、外观与这台设备上的内容。
        </Text>
      </View>

      <AccountPreferenceSettings onRevoke={onAdultRevoked ?? (() => undefined)} />

      {account ? (
        <>
          <AccountProfileCard
            {...(account.profile?.avatarUri === undefined ? {} : { avatarUri: account.profile.avatarUri })}
            {...(account.profile?.displayName === undefined ? {} : { displayName: account.profile.displayName })}
            {...(account.email === undefined ? {} : { email: account.email })}
            {...(account.status === "signedOut" && account.onSignIn !== undefined
              ? { onSignIn: account.onSignIn }
              : {})}
            {...(account.onRetry === undefined ? {} : { onRetry: account.onRetry })}
            {...(account.status === "ready" && account.chooseAvatar !== undefined
              ? { onChangeAvatar: openAvatarActions }
              : {})}
            {...(account.status === "ready" && account.saveDisplayName !== undefined
              ? { onChangeDisplayName: openNicknameEditor }
              : {})}
            status={account.status}
          />
          {profileActionError || account.error === "save" || account.error === "picker" ? (
            <Text accessibilityRole="alert" selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
              账号资料未保存，请重试。
            </Text>
          ) : null}
          {account.error === "permission" ? (
            <Text accessibilityRole="alert" selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
              暂时无法访问相册，请检查系统权限后重试。
            </Text>
          ) : null}
        </>
      ) : null}

      <Modal
        animationType="fade"
        onRequestClose={() => { if (!nicknameSaving) setNicknameEditorOpen(false); }}
        transparent
        visible={nicknameEditorOpen}
      >
        <View
          accessibilityViewIsModal
          style={{
            alignItems: "center",
            backgroundColor: "rgba(0, 0, 0, 0.55)",
            flex: 1,
            justifyContent: "center",
            padding: theme.space.lg,
          }}
        >
          <Card accessible={false} style={{ maxWidth: theme.size.readableContentMax, width: "100%" }}>
            <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>
              更改昵称
            </Text>
            <TextInput
              accessibilityLabel="昵称"
              autoCapitalize="none"
              editable={!nicknameSaving}
              maxLength={48}
              onChangeText={(value) => {
                setNicknameDraft(value);
                setNicknameError(null);
              }}
              style={{
                ...theme.typography.body,
                backgroundColor: theme.color.surfaceMuted,
                borderColor: nicknameError === "invalid" ? theme.color.error : theme.color.interactiveBorder,
                borderRadius: theme.radius.control,
                borderWidth: theme.border.width,
                color: theme.color.text,
                minHeight: theme.size.minimumTouchTarget,
                paddingHorizontal: theme.space.md,
                paddingVertical: theme.space.compact,
              }}
              value={nicknameDraft}
            />
            {nicknameError === "invalid" ? (
              <Text accessibilityRole="alert" selectable style={{ ...theme.typography.caption, color: theme.color.error }}>
                昵称需要 1–24 个字符。
              </Text>
            ) : null}
            {nicknameError === "save" ? (
              <Text accessibilityRole="alert" selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
                账号资料未保存，请重试。
              </Text>
            ) : null}
            <Button label="保存昵称" loading={nicknameSaving} onPress={() => { void saveNickname(); }} />
            <SecondaryButton
              disabled={nicknameSaving}
              label="取消"
              onPress={() => setNicknameEditorOpen(false)}
            />
          </Card>
        </View>
      </Modal>

      <Card accessible={false}>
        <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>
          账户与保存
        </Text>
        <View style={{ gap: theme.space.compact }}>
          <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
            旅程、练习、沟通卡和普通回顾无需账户；使用内界手记必须登录。已登录账号离线时仍可使用自己的本机手记。
          </Text>
          <View style={{ gap: theme.space.xs }}>
            <Text selectable style={{ ...theme.typography.cardTitle, color: theme.color.primary }}>本机保存（当前）</Text>
            <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
              手记、卡片、回顾和设置只保存在这台设备上；登录只会把本机手记与账号关联，不会同步私密正文。
            </Text>
          </View>
          <View style={{ gap: theme.space.xs }}>
            <Text selectable style={{ ...theme.typography.cardTitle, color: theme.color.textSecondary }}>
              邮箱登录（不含同步）
            </Text>
            <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
              登录不会上传日记、沟通卡、回顾或亲密内容。
            </Text>
          </View>
          {account?.status === "ready" && account.onManageAccount ? (
            <Button
              label="管理邮箱账号"
              onPress={account.onManageAccount}
            />
          ) : null}
        </View>
      </Card>

      <Card accessible={false}>
        <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>
          外观
        </Text>
        <View accessibilityRole="radiogroup" style={{ gap: theme.space.compact }}>
          <AppearanceChoice
            checked={appearancePreference === "system"}
            detail={`当前：${resolvedTheme === "dark" ? "深色" : "亮色"}`}
            disabled={appearanceSaving}
            icon="phone-portrait-outline"
            label="跟随系统"
            onPress={() => { void changeAppearance("system"); }}
          />
          <AppearanceChoice
            checked={appearancePreference === "light"}
            disabled={appearanceSaving}
            icon="sunny-outline"
            label="亮色"
            onPress={() => { void changeAppearance("light"); }}
          />
          <AppearanceChoice
            checked={appearancePreference === "dark"}
            disabled={appearanceSaving}
            icon="moon-outline"
            label="深色"
            onPress={() => { void changeAppearance("dark"); }}
          />
        </View>
        {appearanceSaving ? (
          <Text accessibilityLiveRegion="polite" selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
            正在保存外观设置…
          </Text>
        ) : null}
        {appearanceError ? (
          <Text accessibilityRole="alert" selectable style={{ ...theme.typography.body, color: theme.color.error }}>
            外观设置未保存，请重试。
          </Text>
        ) : null}
      </Card>

      <InfoCard title="隐私与本机数据">
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
          旅程、练习、手记、沟通卡和回顾保存在本机。永久删除后无法恢复；能解锁这台设备的人仍可能看到这些内容，请按自己的情况决定是否保留。
        </Text>
        {privacy ? (
          <>
            <View style={{ alignItems: "center", flexDirection: "row", gap: theme.space.md, justifyContent: "space-between" }}>
              <Text selectable style={{ ...theme.typography.body, color: theme.color.text, flex: 1 }}>
                保存私人记录前显示本机提示
              </Text>
              <Switch
                accessibilityLabel="保存私人记录前显示本机提示"
                disabled={privacy.status !== "ready" || privacySaveState === "saving"}
                onValueChange={(enabled) => { void changeJournalSaveNotice(enabled); }}
                trackColor={{ false: theme.color.disabled, true: theme.color.brandSoft }}
                value={privacy.showLocalJournalSaveNotice}
              />
            </View>
            {privacy.status === "loading" ? (
              <Text accessibilityLiveRegion="polite" selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
                正在读取本机隐私设置…
              </Text>
            ) : null}
            {privacySaveState === "saving" ? (
              <Text accessibilityLiveRegion="polite" selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
                正在保存设置…
              </Text>
            ) : null}
            {privacy.status === "error" ? (
              <View style={{ gap: theme.space.sm }}>
                <Text accessibilityRole="alert" selectable style={{ ...theme.typography.caption, color: theme.color.error }}>
                  暂时无法读取本机隐私设置；保存提示会保持开启。
                </Text>
                <SecondaryButton label="重试读取隐私设置" onPress={privacy.retry} />
              </View>
            ) : null}
            {privacySaveState === "error" ? (
              <Text accessibilityRole="alert" selectable style={{ ...theme.typography.caption, color: theme.color.error }}>
                设置尚未保存，请重试。
              </Text>
            ) : null}
          </>
        ) : null}
      </InfoCard>

      {deletion ? <Card accessible={false} style={{ borderColor: theme.color.danger }}>
        <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>
          删除本机数据
        </Text>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
          删除后，当前旅程、手记、卡片、回顾和本机设置都需要重新开始。
        </Text>

        {deleteState === "idle" ? (
          <DestructiveButton label="删除全部本机数据" onPress={() => setDeleteState("confirming")} />
        ) : null}

        {deleteState === "confirming" ? (
          <View style={{ gap: theme.space.md }}>
            <Text accessibilityRole="alert" selectable style={{ ...theme.typography.body, color: theme.color.error }}>
              请再次确认：全部本机数据会被删除，并且无法恢复。
            </Text>
            <DestructiveButton label="确认删除全部本机数据" onPress={() => { void deleteAll(); }} />
            <SecondaryButton label="取消删除" onPress={() => setDeleteState("idle")} />
          </View>
        ) : null}

        {deleteState === "deleting" ? (
          <View accessibilityLiveRegion="polite" style={{ gap: theme.space.sm }}>
            <DestructiveButton label="正在删除本机数据…" loading onPress={() => undefined} />
            <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
              完成前请留在这个画面。
            </Text>
          </View>
        ) : null}

        {deleteState === "error" ? (
          <View style={{ gap: theme.space.md }}>
            <Text accessibilityRole="alert" selectable style={{ ...theme.typography.body, color: theme.color.error }}>
              删除尚未完成；部分本机清理步骤可能已经完成。当前画面会保留，请安全重试直到显示完成。
            </Text>
            <DestructiveButton label="重试删除" onPress={() => { void deleteAll(); }} />
            <SecondaryButton label="取消删除" onPress={() => setDeleteState("idle")} />
          </View>
        ) : null}

        {deleteState === "success" ? (
          <View accessibilityLiveRegion="polite" style={{ gap: theme.space.md }}>
            <Text accessibilityRole="alert" selectable style={{ ...theme.typography.body, color: theme.color.success }}>
              本机数据已删除。
            </Text>
            <Button label="返回首页" onPress={deletion.onContinue} />
          </View>
        ) : null}
      </Card> : null}
    </ScrollView>
  );
}

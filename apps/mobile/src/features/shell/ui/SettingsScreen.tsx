import { useState } from "react";
import { Alert, Modal, ScrollView, Text, TextInput, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import type { ResolvedTheme, ThemePreference } from "../../../core/design/theme";
import { Button } from "../../../core/ui/Button";
import { Card } from "../../../core/ui/Card";
import { HelpText, PageHeader } from "../../../core/ui/page-header";
import { SelectionField } from "../../../core/ui/selection-field";
import { ActionRow } from "../../../core/ui/action-row";
import { TextAction } from "../../../core/ui/text-action";
import { AccountProfileCard } from "../../account/ui/AccountProfileCard";
import { AccountPreferenceSettings } from "../../account/ui/AccountPreferenceSettings";

export type DeleteCapability = {
  deleteAllData(): Promise<void>;
  onContinue(): void;
};

type AccountCapability = {
  status: "signedOut" | "loading" | "ready" | "error";
  email?: string;
  profile?: { displayName: string; avatarUri?: string };
  error?: "load" | "save" | "permission" | "picker" | null;
  onSignIn?(): void;
  onRetry?(): void;
  chooseAvatar?(): Promise<void>;
  removeAvatar?(): Promise<void>;
  saveDisplayName?(value: string): Promise<void>;
};

export type PrivacySettingsCapability = {
  changeJournalSaveNotice(enabled: boolean): Promise<void>;
  retry(): void;
  showLocalJournalSaveNotice: boolean;
  status: "loading" | "ready" | "error";
};

export type SettingsScreenProps = {
  account?: AccountCapability | undefined;
  appearancePreference: ThemePreference;
  appearanceSaving: boolean;
  onOpenAccountPrivacy(): void;
  resolvedTheme: ResolvedTheme;
  onAppearancePreferenceChange(preference: ThemePreference): Promise<void>;
  onBack(): void;
  onAdultRevoked?: (() => void) | undefined;
};

export function SettingsScreen({
  account,
  appearancePreference,
  appearanceSaving,
  onOpenAccountPrivacy,
  onAppearancePreferenceChange,
  onBack,
  onAdultRevoked,
  resolvedTheme,
}: SettingsScreenProps) {
  const theme = useTheme();
  const [appearanceError, setAppearanceError] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [nicknameEditorOpen, setNicknameEditorOpen] = useState(false);
  const [nicknameError, setNicknameError] = useState<"invalid" | "save" | null>(null);
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [profileActionError, setProfileActionError] = useState(false);

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
      <PageHeader title="设置" onBack={onBack} help={<>
        <HelpText>管理账户、保存方式、外观与这台设备上的内容。</HelpText>
        <HelpText>旅程、练习、沟通卡和普通回顾无需账户；使用内界手记必须登录。已登录账号离线时仍可使用自己的本机手记。</HelpText>
        <HelpText>本机保存（当前）：手记、卡片、回顾和设置只保存在这台设备上；登录只会把本机手记与账号关联，不会同步私密正文。</HelpText>
        <HelpText>邮箱登录（不含同步）：登录不会上传日记、沟通卡、回顾或亲密内容。普通 AI 聊天发送后直接取得回复；开启「帮我批准」后，会将问题涉及的本账号日记和旅程内容发送至内界服务端，可能由 DeepSeek 生成回复。选择会延续到新对话和页面切换，退出 App 后恢复关闭，也可随时手动关闭。</HelpText>
      </>} />

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

      <AccountPreferenceSettings onRevoke={onAdultRevoked ?? (() => undefined)} />
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
            <TextAction
              disabled={nicknameSaving}
              label="取消"
              onPress={() => setNicknameEditorOpen(false)}
            />
          </Card>
        </View>
      </Modal>

      <Card accessible={false}>
        <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>
          外观
        </Text>
        <SelectionField<ThemePreference> label="外观" value={appearancePreference} disabled={appearanceSaving}
          options={[
            { value: "system", label: "跟随系统", detail: `当前：${resolvedTheme === "dark" ? "深色" : "亮色"}` },
            { value: "light", label: "亮色" },
            { value: "dark", label: "深色" },
          ]} onChange={(value) => { void changeAppearance(value); }} />
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

      <Card accessible={false} style={{ borderColor: theme.color.danger }}><ActionRow title="账号与隐私" subtitle="账号管理、隐私设置与危险操作" onPress={onOpenAccountPrivacy} /></Card>
    </ScrollView>
  );
}

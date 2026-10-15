import { useRef, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Card } from "../../../core/ui/Card";
import { InfoCard } from "../../../core/ui/info-card";
import { HelpText, PageHeader } from "../../../core/ui/page-header";
import { ActionRow } from "../../../core/ui/action-row";
import { BottomSheet } from "../../../core/ui/bottom-sheet";
import { TextAction } from "../../../core/ui/text-action";
import type {
  DeleteCapability,
  PrivacySettingsCapability,
} from "./SettingsScreen";
type DeleteState = "idle" | "confirming" | "deleting" | "error" | "success";

function DestructiveButton({
  label,
  loading = false,
  onPress,
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
        backgroundColor: pressed
          ? theme.color.surfacePressed
          : theme.color.dangerSurface,
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
        width: "100%",
      })}
    >
      <Text
        style={{
          ...theme.typography.button,
          color: theme.color.onDanger,
          flexShrink: 1,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
      {loading ? (
        <Text
          style={{ ...theme.typography.caption, color: theme.color.onDanger }}
        >
          处理中
        </Text>
      ) : null}
    </Pressable>
  );
}

export type AccountPrivacyScreenProps = {
  signedIn: boolean;
  onSignIn(): void;
  onLogout?: (() => Promise<void>) | undefined;
  onDeleteAccount?: (() => void) | undefined;
  onBack(): void;
  deletion?: DeleteCapability | undefined;
  privacy?: PrivacySettingsCapability | undefined;
};
export function AccountPrivacyScreen({
  signedIn,
  onSignIn,
  onLogout,
  onDeleteAccount,
  onBack,
  deletion,
  privacy,
}: AccountPrivacyScreenProps) {
  const theme = useTheme();
  const [deleteState, setDeleteState] = useState<DeleteState>("idle");
  const deletionInFlight = useRef(false);
  const [privacySaveState, setPrivacySaveState] = useState<
    "idle" | "saving" | "error"
  >("idle");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutSaving, setLogoutSaving] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const logoutInFlight = useRef(false);
  const logout = async () => {
    if (!onLogout || logoutInFlight.current) return;
    logoutInFlight.current = true;
    setLogoutSaving(true);
    setLogoutError(false);
    try {
      await onLogout();
      setLogoutOpen(false);
    } catch {
      setLogoutError(true);
    } finally {
      logoutInFlight.current = false;
      setLogoutSaving(false);
    }
  };
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
      contentInsetAdjustmentBehavior="automatic"
      testID="account-privacy-scroll"
      contentContainerStyle={{
        alignSelf: "center",
        gap: theme.space.xl,
        maxWidth: theme.size.readableContentMax,
        paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.xl,
        width: "100%",
      }}
      style={{ backgroundColor: theme.color.background, flex: 1 }}
    >
      <PageHeader
        title="账号与隐私"
        onBack={onBack}
        help={
          <>
            <HelpText>
              邮箱登录不包含私密正文同步；旅程、手记、沟通卡和回顾保存在这台设备上。
            </HelpText>
            <HelpText>
              本机清理与删除账号是不同操作，请分别查看确认说明。
            </HelpText>
          </>
        }
      />
      <InfoCard title="账户与保存">
        <Text
          selectable
          style={{ ...theme.typography.body, color: theme.color.textSecondary }}
        >
          本机保存（当前） · 邮箱登录不含同步
        </Text>
      </InfoCard>
      {!signedIn ? <ActionRow title="邮箱登录" onPress={onSignIn} /> : null}
      <InfoCard title="隐私与本机数据">
        <Text
          selectable
          style={{ ...theme.typography.body, color: theme.color.textSecondary }}
        >
          旅程、练习、手记、沟通卡和回顾保存在本机。永久删除后无法恢复；能解锁这台设备的人仍可能看到这些内容，请按自己的情况决定是否保留。
        </Text>
        {privacy ? (
          <>
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                gap: theme.space.md,
                justifyContent: "space-between",
              }}
            >
              <Text
                selectable
                style={{
                  ...theme.typography.body,
                  color: theme.color.text,
                  flex: 1,
                }}
              >
                保存私人记录前显示本机提示
              </Text>
              <Switch
                accessibilityLabel="保存私人记录前显示本机提示"
                disabled={
                  privacy.status !== "ready" || privacySaveState === "saving"
                }
                onValueChange={(enabled) => {
                  void changeJournalSaveNotice(enabled);
                }}
                trackColor={{
                  false: theme.color.disabled,
                  true: theme.color.brandSoft,
                }}
                value={privacy.showLocalJournalSaveNotice}
              />
            </View>
            {privacy.status === "loading" ? (
              <Text
                accessibilityLiveRegion="polite"
                selectable
                style={{
                  ...theme.typography.caption,
                  color: theme.color.textSecondary,
                }}
              >
                正在读取本机隐私设置…
              </Text>
            ) : null}
            {privacySaveState === "saving" ? (
              <Text
                accessibilityLiveRegion="polite"
                selectable
                style={{
                  ...theme.typography.caption,
                  color: theme.color.textSecondary,
                }}
              >
                正在保存设置…
              </Text>
            ) : null}
            {privacy.status === "error" ? (
              <View style={{ gap: theme.space.sm }}>
                <Text
                  accessibilityRole="alert"
                  selectable
                  style={{
                    ...theme.typography.caption,
                    color: theme.color.error,
                  }}
                >
                  暂时无法读取本机隐私设置；保存提示会保持开启。
                </Text>
                <TextAction label="重试读取隐私设置" onPress={privacy.retry} />
              </View>
            ) : null}
            {privacySaveState === "error" ? (
              <Text
                accessibilityRole="alert"
                selectable
                style={{
                  ...theme.typography.caption,
                  color: theme.color.error,
                }}
              >
                设置尚未保存，请重试。
              </Text>
            ) : null}
          </>
        ) : null}
      </InfoCard>

      {deletion ? (
        <Card accessible={false} style={{ borderColor: theme.color.danger }}>
          <Text
            accessibilityRole="header"
            selectable
            style={{ ...theme.typography.heading, color: theme.color.text }}
          >
            删除本机数据
          </Text>
          <Text
            selectable
            style={{
              ...theme.typography.body,
              color: theme.color.textSecondary,
            }}
          >
            删除后，当前旅程、手记、卡片、回顾和本机设置都需要重新开始。
          </Text>

          {deleteState === "idle" ? (
            <DestructiveButton
              label="删除全部本机数据"
              onPress={() => setDeleteState("confirming")}
            />
          ) : null}

          {deleteState === "confirming" ? (
            <View style={{ gap: theme.space.md }}>
              <Text
                accessibilityRole="alert"
                selectable
                style={{ ...theme.typography.body, color: theme.color.error }}
              >
                请再次确认：全部本机数据会被删除，并且无法恢复。
              </Text>
              <DestructiveButton
                label="确认删除全部本机数据"
                onPress={() => {
                  void deleteAll();
                }}
              />
              <TextAction
                label="取消删除"
                onPress={() => setDeleteState("idle")}
              />
            </View>
          ) : null}

          {deleteState === "deleting" ? (
            <View
              accessibilityLiveRegion="polite"
              style={{ gap: theme.space.sm }}
            >
              <DestructiveButton
                label="正在删除本机数据…"
                loading
                onPress={() => undefined}
              />
              <Text
                selectable
                style={{
                  ...theme.typography.caption,
                  color: theme.color.textSecondary,
                }}
              >
                完成前请留在这个画面。
              </Text>
            </View>
          ) : null}

          {deleteState === "error" ? (
            <View style={{ gap: theme.space.md }}>
              <Text
                accessibilityRole="alert"
                selectable
                style={{ ...theme.typography.body, color: theme.color.error }}
              >
                删除尚未完成；部分本机清理步骤可能已经完成。当前画面会保留，请安全重试直到显示完成。
              </Text>
              <DestructiveButton
                label="重试删除"
                onPress={() => {
                  void deleteAll();
                }}
              />
              <TextAction
                label="取消删除"
                onPress={() => setDeleteState("idle")}
              />
            </View>
          ) : null}

          {deleteState === "success" ? (
            <View
              accessibilityLiveRegion="polite"
              style={{ gap: theme.space.md }}
            >
              <Text
                accessibilityRole="alert"
                selectable
                style={{ ...theme.typography.body, color: theme.color.success }}
              >
                本机数据已删除。
              </Text>
              <Button label="返回首页" onPress={deletion.onContinue} />
            </View>
          ) : null}
        </Card>
      ) : null}

      {signedIn ? (
        <Card accessible={false} style={{ borderColor: theme.color.danger }}>
          {onLogout ? (
            <DestructiveButton
              label="退出登录"
              onPress={() => {
                setLogoutError(false);
                setLogoutOpen(true);
              }}
            />
          ) : null}
          {onDeleteAccount ? (
            <DestructiveButton label="删除账号" onPress={onDeleteAccount} />
          ) : null}
          <Text
            selectable
            style={{
              ...theme.typography.caption,
              color: theme.color.textSecondary,
            }}
          >
            删除账号会进入身份验证与最终确认页面，随后选择保留或永久删除当前账号的本机手记；也会清除该账号的本机
            AI 对话历史。
          </Text>
        </Card>
      ) : null}
      <BottomSheet
        title="确认退出登录"
        visible={logoutOpen}
        dismissible={!logoutSaving}
        onClose={() => setLogoutOpen(false)}
      >
        <Text
          style={{ ...theme.typography.body, color: theme.color.textSecondary }}
        >
          退出后，本机资料会保留。需要登录的手记与 AI 功能需重新登录后使用。
        </Text>
        {logoutError ? (
          <Text
            accessibilityRole="alert"
            style={{ ...theme.typography.body, color: theme.color.error }}
          >
            退出尚未完成，请重试。
          </Text>
        ) : null}
        <DestructiveButton
          label="确认退出登录"
          loading={logoutSaving}
          onPress={() => {
            void logout();
          }}
        />
        <TextAction
          label="取消退出"
          disabled={logoutSaving}
          onPress={() => setLogoutOpen(false)}
        />
      </BottomSheet>
    </ScrollView>
  );
}

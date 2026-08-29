import type { EmailChallengeAccepted } from "@cave/contracts";
import { useRef, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Card } from "../../../core/ui/Card";
import { IconTextAction } from "../../../core/ui/icon-text-action";
import { SecondaryButton } from "../../../core/ui/secondary-button";

type Props = {
  status: "loading" | "signedOut" | "signedIn" | "offline";
  adultAuthorized: boolean;
  onBack(): void;
  onAdultGate?(): void;
  onRequestEmail(email: string): Promise<EmailChallengeAccepted>;
  onVerifyCode(challengeId: string, code: string, email: string): Promise<void>;
  onLogout(): Promise<void>;
  onDeleteAccount(): void;
};

type AcceptedChallenge = {
  accepted: EmailChallengeAccepted;
  email: string;
};

export function EmailAuthScreen(props: Props) {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<AcceptedChallenge | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const run = async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try { await action(); } catch {
      if (__DEV__) console.warn("auth.action.failed");
      setError("操作未完成。请检查网络、邮箱或验证码后重试。");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };
  const inputStyle = {
    ...theme.typography.body,
    backgroundColor: theme.color.surface,
    borderColor: theme.color.interactiveBorder,
    borderCurve: "continuous" as const,
    borderRadius: theme.radius.control,
    borderWidth: theme.border.width,
    color: theme.color.text,
    minHeight: theme.size.primaryActionHeight,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.compact,
  };

  return (
    <ScrollView
      contentContainerStyle={{ alignSelf: "center", gap: theme.space.xl, maxWidth: theme.size.readableContentMax, padding: theme.space.lg, width: "100%" }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
    >
      <IconTextAction icon="arrow-back" label="返回" onPress={props.onBack} />
      <Text accessibilityRole="header" selectable style={{ ...theme.typography.title, color: theme.color.text }}>邮箱账户</Text>
      <Card accessible={false}>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
          邮箱仅用于登录和账户安全。登录不会上传日记、沟通卡、回顾或亲密内容；这些内容仍只在本机。
        </Text>
      </Card>

      {!props.adultAuthorized ? (
        <Card accessible={false}>
          <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>邮箱登录只向已在本机确认成年的用户开放。</Text>
          <Button label="先完成成年确认" onPress={() => props.onAdultGate?.()} />
        </Card>
      ) : props.status === "signedIn" || props.status === "offline" ? (
        <Card accessible={false}>
          <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>
            {props.status === "offline" ? "已登录（当前离线）" : "已登录"}
          </Text>
          <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>退出只清除这台设备的会话，不删除本机内容。</Text>
          <Button label="从这台设备退出登录" loading={pending} onPress={() => { void run(props.onLogout); }} />
          <SecondaryButton label="删除云端账户" onPress={props.onDeleteAccount} />
        </Card>
      ) : (
        <Card accessible={false}>
          {challenge === null ? (
            <View style={{ gap: theme.space.md }}>
              <TextInput
                accessibilityLabel="邮箱地址"
                autoCapitalize="none"
                autoComplete="email"
                inputMode="email"
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={theme.color.textMuted}
                style={inputStyle}
                value={email}
              />
              <Button
                disabled={!email.includes("@")}
                label="发送验证码"
                loading={pending}
                onPress={() => {
                  void run(async () => {
                    const challengeEmail = email.trim().toLowerCase();
                    const accepted = await props.onRequestEmail(challengeEmail);
                    setChallenge({ accepted, email: challengeEmail });
                  });
                }}
              />
            </View>
          ) : (
            <View style={{ gap: theme.space.md }}>
              <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
                验证码已发送，10 分钟内有效。为保护隐私，无论邮箱是否已注册，提示都相同。
              </Text>
              <TextInput
                accessibilityLabel="6 位验证码"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                onChangeText={(value) => setCode(value.replace(/\D/gu, ""))}
                style={{ ...inputStyle, fontVariant: ["tabular-nums"], letterSpacing: 6 }}
                value={code}
              />
              <Button
                disabled={!/^\d{6}$/u.test(code)}
                label="登录"
                loading={pending}
                onPress={() => {
                  void run(() => props.onVerifyCode(
                    challenge.accepted.challengeId,
                    code,
                    challenge.email,
                  ));
                }}
              />
              <SecondaryButton label="更换邮箱" onPress={() => { setChallenge(null); setCode(""); setError(null); }} />
              <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
                {challenge.accepted.resendAfterSeconds} 秒后可重新发送。
              </Text>
            </View>
          )}
          {error ? <Text accessibilityRole="alert" selectable style={{ ...theme.typography.body, color: theme.color.error }}>{error}</Text> : null}
        </Card>
      )}
    </ScrollView>
  );
}

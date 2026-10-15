import type { EmailChallengeAccepted } from "@cave/contracts";
import { useEffect, useRef, useState } from "react";
import { AppState, ScrollView, Text, TextInput, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Card } from "../../../core/ui/Card";
import { HelpText, PageHeader } from "../../../core/ui/page-header";
import { TextAction } from "../../../core/ui/text-action";
import { getAuthErrorMessage } from "./auth-error-message";

type Props = {
  status: "loading" | "signedOut" | "signedIn" | "offline";
  adultAuthorized: boolean;
  onBack(): void;
  onAdultGate?(): void;
  onRequestEmail(email: string): Promise<EmailChallengeAccepted>;
  onVerifyCode(challengeId: string, code: string, email: string): Promise<void>;
  onPasswordLogin?(email: string, password: string): Promise<void>;
  onRegister?(challengeId: string, code: string, email: string, password: string): Promise<void>;
  onLogout(): Promise<void>;
  onDeleteAccount(): void;
};

type AcceptedChallenge = {
  accepted: EmailChallengeAccepted;
  email: string;
  resendAt: number;
};

export function EmailAuthScreen(props: Props) {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"code" | "password" | "register">("code");
  const [password, setPassword] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<AcceptedChallenge | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (challenge === null) return;
    const update = () => setRemaining(Math.max(0, Math.ceil((challenge.resendAt - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") update(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [challenge]);

  const run = async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try { await action(); } catch (caught) {
      if (__DEV__) console.warn("auth.action.failed");
      setError(getAuthErrorMessage(caught, true));
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
    paddingVertical: 0,
    textAlignVertical: "center" as const,
    includeFontPadding: false,
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.color.background, flex: 1 }}
      contentContainerStyle={{ alignSelf: "center", gap: theme.space.xl, maxWidth: theme.size.readableContentMax, padding: theme.space.lg, width: "100%" }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
    >
      <PageHeader title="邮箱账户" onBack={props.onBack} help={<HelpText>邮箱用于登录和账户安全。成年确认与界面称呼会保存到账号；日记、沟通卡、回顾或亲密内容仍只在本机。</HelpText>} />

      {props.status === "signedIn" || props.status === "offline" ? (
        <Card accessible={false}>
          <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>
            {props.status === "offline" ? "已登录（当前离线）" : "已登录"}
          </Text>
          <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>退出只清除这台设备的会话，不删除本机内容。</Text>
          <Button label="从这台设备退出登录" loading={pending} onPress={() => { void run(props.onLogout); }} />
          <TextAction label="删除云端账户" onPress={props.onDeleteAccount} />
        </Card>
      ) : (
        <Card accessible={false}>
          {challenge === null ? (
            <View style={{ gap: theme.space.md }}>
              <TextAction label="验证码登录" disabled={pending} onPress={() => { setMode("code"); setPassword(""); setError(null); }} />
              <TextAction label="密码登录" disabled={pending} onPress={() => { setMode("password"); setPassword(""); setError(null); }} />
              <TextAction label="注册 / 设置初始密码" disabled={pending} onPress={() => { setMode("register"); setPassword(""); setError(null); }} />
              <TextInput
                accessibilityLabel="邮箱地址"
                autoCapitalize="none"
                autoComplete="email"
                inputMode="email"
                keyboardAppearance={theme.name}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={theme.color.textMuted}
                style={inputStyle}
                value={email}
              />
              <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>邮箱仅用于登录和账户安全，不会上传日记、沟通卡、回顾或亲密内容。</Text>
              {mode !== "code" ? <TextInput
                accessibilityLabel={mode === "register" ? "设置密码" : "密码"}
                autoCapitalize="none" autoCorrect={false} secureTextEntry
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                placeholder="10–128 位密码" placeholderTextColor={theme.color.textMuted}
                keyboardAppearance={theme.name} style={inputStyle} value={password} onChangeText={setPassword}
              /> : null}
              {mode === "register" ? <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>注册必须设置密码并验证邮箱。已有无密码账户可在此设置初始密码。</Text> : null}
              <Button
                disabled={!email.includes("@") || (mode !== "code" && (password.length < 10 || password.length > 128))}
                label={mode === "password" ? "登录" : "发送验证码"}
                loading={pending}
                onPress={() => {
                  void run(async () => {
                    const challengeEmail = email.trim().toLowerCase();
                    if (mode === "password") {
                      if (!props.onPasswordLogin) throw new Error("password-login-unavailable");
                      await props.onPasswordLogin(challengeEmail, password);
                      setPassword("");
                      return;
                    }
                    const accepted = await props.onRequestEmail(challengeEmail);
                    setChallenge({ accepted, email: challengeEmail, resendAt: Date.now() + accepted.resendAfterSeconds * 1000 });
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
                keyboardAppearance={theme.name}
                maxLength={6}
                onChangeText={(value) => setCode(value.replace(/\D/gu, ""))}
                style={{ ...inputStyle, fontVariant: ["tabular-nums"], letterSpacing: 6 }}
                value={code}
              />
              <Button
                disabled={!/^\d{6}$/u.test(code)}
                label={mode === "register" ? "注册并登录" : "登录"}
                loading={pending}
                onPress={() => {
                  void run(async () => {
                    if (mode === "register") {
                      if (!props.onRegister) throw new Error("registration-unavailable");
                      await props.onRegister(challenge.accepted.challengeId, code, challenge.email, password);
                    } else {
                      await props.onVerifyCode(challenge.accepted.challengeId, code, challenge.email);
                    }
                    setPassword("");
                  });
                }}
              />
              <TextAction label="更换邮箱" disabled={pending} onPress={() => { setChallenge(null); setCode(""); setPassword(""); setError(null); }} />
              {remaining > 0 ? <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
                {remaining} 秒后可重新发送。
              </Text> : <TextAction label="重新发送验证码" disabled={pending} onPress={() => { void run(async () => {
                const accepted = await props.onRequestEmail(challenge.email);
                setCode("");
                setChallenge({ accepted, email: challenge.email, resendAt: Date.now() + accepted.resendAfterSeconds * 1000 });
              }); }} />}

            </View>
          )}
          {error ? <Text accessibilityRole="alert" selectable style={{ ...theme.typography.body, color: theme.color.error }}>{error}</Text> : null}
        </Card>
      )}
    </ScrollView>
  );
}

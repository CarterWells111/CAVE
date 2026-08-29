import type { AccountDeletionGrantResponse, EmailChallengeAccepted } from "@cave/contracts";
import { useRef, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Card } from "../../../core/ui/Card";
import { IconTextAction } from "../../../core/ui/icon-text-action";
import { SecondaryButton } from "../../../core/ui/secondary-button";

type Props = {
  onBack(): void;
  onRequestChallenge(email: string): Promise<EmailChallengeAccepted>;
  onVerifyChallenge(challengeId: string, code: string): Promise<AccountDeletionGrantResponse>;
  createIdempotencyKey(): string;
  temporaryPreview: boolean;
  onClearCurrentAccountJournal(): Promise<void>;
  onDeleteAccount(grant: string, idempotencyKey: string): Promise<void>;
  onComplete(): void;
};

type JournalDeletionChoice = "keep" | "delete";
type ErrorKind = "generic" | "local" | "cloud-after-local";

export function DeleteAccountScreen(props: Props) {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<EmailChallengeAccepted | null>(null);
  const [grant, setGrant] = useState<AccountDeletionGrantResponse | null>(null);
  const [journalChoice, setJournalChoice] = useState<JournalDeletionChoice | null>(null);
  const [localJournalDeleted, setLocalJournalDeleted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ErrorKind | null>(null);
  const idempotencyKey = useRef<string | null>(null);
  const inFlight = useRef(false);
  const run = async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true; setPending(true); setError(null);
    try { await action(); } catch { setError("generic"); } finally { inFlight.current = false; setPending(false); }
  };
  const deleteAccount = async () => {
    if (inFlight.current || grant === null || journalChoice === null) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    let didDeleteLocalJournal = localJournalDeleted;
    try {
      if (journalChoice === "delete" && !didDeleteLocalJournal) {
        try {
          await props.onClearCurrentAccountJournal();
          didDeleteLocalJournal = true;
          setLocalJournalDeleted(true);
        } catch {
          setError("local");
          return;
        }
      }
      idempotencyKey.current ??= props.createIdempotencyKey();
      try {
        await props.onDeleteAccount(grant.deletionGrant, idempotencyKey.current);
      } catch {
        setError(didDeleteLocalJournal ? "cloud-after-local" : "generic");
        return;
      }
      props.onComplete();
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };
  const inputStyle = {
    ...theme.typography.body, backgroundColor: theme.color.surface, borderColor: theme.color.interactiveBorder,
    borderCurve: "continuous" as const, borderRadius: theme.radius.control, borderWidth: theme.border.width,
    color: theme.color.text, minHeight: theme.size.primaryActionHeight, paddingHorizontal: theme.space.md,
  };
  return (
    <ScrollView contentContainerStyle={{ alignSelf: "center", gap: theme.space.xl, maxWidth: theme.size.readableContentMax, padding: theme.space.lg, width: "100%" }} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
      <IconTextAction icon="arrow-back" label="返回" onPress={props.onBack} />
      <Text accessibilityRole="header" selectable style={{ ...theme.typography.title, color: theme.color.text }}>删除云端账户</Text>
      <Card accessible={false} style={{ borderColor: theme.color.danger }}>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.error }}>
          此操作会删除邮箱账户与服务端会话。完成验证后，你需要明确选择是否同时删除当前账户在这台设备上的手记。
        </Text>
        {challenge === null ? <View style={{ gap: theme.space.md }}>
          <TextInput accessibilityLabel="账户邮箱" autoCapitalize="none" inputMode="email" onChangeText={setEmail} style={inputStyle} value={email} />
          <Button disabled={!email.includes("@")} label="发送删除验证码" loading={pending} onPress={() => { void run(async () => setChallenge(await props.onRequestChallenge(email))); }} />
        </View> : grant === null ? <View style={{ gap: theme.space.md }}>
          <TextInput accessibilityLabel="6 位删除验证码" inputMode="numeric" maxLength={6} onChangeText={(value) => setCode(value.replace(/\D/gu, ""))} style={{ ...inputStyle, fontVariant: ["tabular-nums"] }} value={code} />
          <Button disabled={!/^\d{6}$/u.test(code)} label="验证并继续" loading={pending} onPress={() => { void run(async () => setGrant(await props.onVerifyChallenge(challenge.challengeId, code))); }} />
        </View> : <View style={{ gap: theme.space.md }}>
          <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>请选择本机手记的处理方式</Text>
          <Text selectable style={{ ...theme.typography.body, color: theme.color.error }}>
            {props.temporaryPreview
              ? "当前是 Expo Go 临时预览；手记只存在于本次内存会话，关闭 App 后即会丢失，无法加密持久保留。"
              : "若保留，手记仍仅保存在本机，并以加密状态保持锁定；删除账户后将无法再解锁。"}
          </Text>
          <SecondaryButton label="保留本机手记" onPress={() => { setJournalChoice("keep"); setError(null); }} />
          <SecondaryButton label="永久删除本机手记" onPress={() => { setJournalChoice("delete"); setError(null); }} />
          {journalChoice === "keep" ? <Text selectable style={{ ...theme.typography.body, color: theme.color.textMuted }}>
            {props.temporaryPreview
              ? "已选择：仅在当前 Expo Go 会话中暂时保留；关闭 App 后内容会丢失。"
              : "已选择：保留当前账户的本机手记。这些内容不会上传，删除账户后也无法恢复访问。"}
          </Text> : null}
          {journalChoice === "delete" ? <Text selectable style={{ ...theme.typography.body, color: theme.color.error }}>
            已选择：先永久删除当前账户的本机手记，再删除云端账户。其他账户的本机手记不受影响。
          </Text> : null}
          {journalChoice !== null ? <Button
            label={journalChoice === "delete" ? "删除手记并删除云端账户" : "确认删除云端账户"}
            loading={pending}
            onPress={() => { void deleteAccount(); }}
          /> : null}
          <SecondaryButton label="取消" onPress={props.onBack} />
        </View>}
        {error === "generic" ? <Text accessibilityRole="alert" selectable style={{ ...theme.typography.body, color: theme.color.error }}>操作未完成，请检查网络或验证码后重试。</Text> : null}
        {error === "local" ? <Text accessibilityRole="alert" selectable style={{ ...theme.typography.body, color: theme.color.error }}>本机手记未能删除，云端账户保持不变。请重试。</Text> : null}
        {error === "cloud-after-local" ? <Text accessibilityRole="alert" selectable style={{ ...theme.typography.body, color: theme.color.error }}>本机手记已删除，但云端账户未能删除。请重试云端删除。</Text> : null}
      </Card>
    </ScrollView>
  );
}

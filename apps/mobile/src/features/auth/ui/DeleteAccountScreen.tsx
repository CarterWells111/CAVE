import type { AccountDeletionGrantResponse, EmailChallengeAccepted } from "@cave/contracts";
import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Card } from "../../../core/ui/Card";
import { IconTextAction } from "../../../core/ui/icon-text-action";
import { SecondaryButton } from "../../../core/ui/secondary-button";
import { JournalDeletionCleanupRequiredError } from "../../journal/infrastructure/journal-repository";
import type { JournalPersistence } from "../../journey/runtime/journey-runtime";
import {
  getAuthErrorMessage,
  isAuthReauthenticationRequired,
} from "./auth-error-message";

type Props = {
  onBack(): void;
  onRequestChallenge(email: string): Promise<EmailChallengeAccepted>;
  onVerifyChallenge(challengeId: string, code: string): Promise<AccountDeletionGrantResponse>;
  createIdempotencyKey(): string;
  journalPersistence: JournalPersistence;
  onEnsureJournalCleanup(): Promise<boolean>;
  onClearCurrentAccountJournal(): Promise<void>;
  onDeleteAccount(grant: string, idempotencyKey: string): Promise<void>;
  onComplete(): void;
};

type JournalDeletionChoice = "keep" | "delete";
type ErrorState =
  | { kind: "auth"; message: string }
  | { kind: "local" }
  | { kind: "local-cleanup" }
  | { kind: "local-check" }
  | { kind: "cloud-after-local" };

export function DeleteAccountScreen(props: Props) {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<EmailChallengeAccepted | null>(null);
  const [grant, setGrant] = useState<AccountDeletionGrantResponse | null>(null);
  const [journalChoice, setJournalChoice] = useState<JournalDeletionChoice | null>(null);
  const [localJournalDeleted, setLocalJournalDeleted] = useState(false);
  const [localCleanupPending, setLocalCleanupPending] = useState(false);
  const [cleanupCheckAttempt, setCleanupCheckAttempt] = useState(0);
  const [cleanupCheckStatus, setCleanupCheckStatus] = useState<"checking" | "ready" | "error">("checking");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const idempotencyKey = useRef<string | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    let active = true;
    setCleanupCheckStatus("checking");
    setError(null);
    void props.onEnsureJournalCleanup().then(
      (recoveredDeletion) => {
        if (!active) return;
        setLocalCleanupPending(false);
        if (recoveredDeletion) {
          setLocalJournalDeleted(true);
          setJournalChoice("delete");
        }
        setCleanupCheckStatus("ready");
      },
      (caught: unknown) => {
        if (!active) return;
        if (caught instanceof JournalDeletionCleanupRequiredError) {
          if (caught.ownerDeletionCommitted) {
            setLocalJournalDeleted(true);
            setJournalChoice("delete");
          }
          setLocalCleanupPending(true);
          setError({ kind: "local-cleanup" });
        } else {
          setError({ kind: "local-check" });
        }
        setCleanupCheckStatus("error");
      },
    );
    return () => { active = false; };
  }, [cleanupCheckAttempt, props.onEnsureJournalCleanup]);
  const run = async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true; setPending(true); setError(null);
    try {
      await action();
    } catch (caught) {
      setError({ kind: "auth", message: getAuthErrorMessage(caught) });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };
  const deleteAccount = async () => {
    if (inFlight.current || grant === null || journalChoice === null) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    let didDeleteLocalJournal = localJournalDeleted;
    try {
      if (journalChoice === "delete" && (!didDeleteLocalJournal || localCleanupPending)) {
        try {
          await props.onClearCurrentAccountJournal();
          didDeleteLocalJournal = true;
          setLocalJournalDeleted(true);
          setLocalCleanupPending(false);
        } catch (caught) {
          if (caught instanceof JournalDeletionCleanupRequiredError) {
            didDeleteLocalJournal = true;
            setLocalJournalDeleted(true);
            setLocalCleanupPending(true);
            setError({ kind: "local-cleanup" });
          } else {
            setError({ kind: "local" });
          }
          return;
        }
      }
      try {
        const ownerDeletionCommitted = await props.onEnsureJournalCleanup();
        setLocalCleanupPending(false);
        if (ownerDeletionCommitted && !didDeleteLocalJournal) {
          setLocalJournalDeleted(true);
          setJournalChoice("delete");
          return;
        }
      } catch (caught) {
        if (caught instanceof JournalDeletionCleanupRequiredError) {
          if (caught.ownerDeletionCommitted) {
            didDeleteLocalJournal = true;
            setLocalJournalDeleted(true);
            setJournalChoice("delete");
          }
          setLocalCleanupPending(true);
          setError({ kind: "local-cleanup" });
        } else {
          setError({ kind: "local-check" });
        }
        return;
      }
      idempotencyKey.current ??= props.createIdempotencyKey();
      try {
        await props.onDeleteAccount(grant.deletionGrant, idempotencyKey.current);
      } catch (caught) {
        if (isAuthReauthenticationRequired(caught)) {
          setGrant(null);
          setChallenge(null);
          setCode("");
          idempotencyKey.current = null;
          setError({ kind: "auth", message: getAuthErrorMessage(caught) });
          return;
        }
        setError(didDeleteLocalJournal
          ? { kind: "cloud-after-local" }
          : { kind: "auth", message: getAuthErrorMessage(caught) });
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
        {localJournalDeleted ? <Text selectable style={{ ...theme.typography.body, color: theme.color.error }}>
          {localCleanupPending
            ? "本机手记已从 App 中删除，但安全清理仍需重试；本机处理已不可更改。"
            : "本机手记已永久删除，无法恢复。重新验证或重试只会继续删除云端账户。"}
        </Text> : localCleanupPending ? <Text selectable style={{ ...theme.typography.body, color: theme.color.error }}>
          本机有已删除内容的安全清理尚未完成；完成前不能删除云端账户。
        </Text> : null}
        {cleanupCheckStatus === "checking" ? <Text accessibilityLiveRegion="polite" selectable style={{ ...theme.typography.body, color: theme.color.textMuted }}>
          正在检查本机手记删除状态…
        </Text> : cleanupCheckStatus === "error" ? <SecondaryButton
          label={localCleanupPending ? "重试本机安全清理" : "重试本机删除状态检查"}
          onPress={() => setCleanupCheckAttempt((value) => value + 1)}
        /> : challenge === null ? <View style={{ gap: theme.space.md }}>
          <TextInput accessibilityLabel="账户邮箱" autoCapitalize="none" inputMode="email" onChangeText={setEmail} style={inputStyle} value={email} />
          <Button disabled={!email.includes("@")} label="发送删除验证码" loading={pending} onPress={() => { void run(async () => setChallenge(await props.onRequestChallenge(email))); }} />
        </View> : grant === null ? <View style={{ gap: theme.space.md }}>
          <TextInput accessibilityLabel="6 位删除验证码" inputMode="numeric" maxLength={6} onChangeText={(value) => setCode(value.replace(/\D/gu, ""))} style={{ ...inputStyle, fontVariant: ["tabular-nums"] }} value={code} />
          <Button disabled={!/^\d{6}$/u.test(code)} label="验证并继续" loading={pending} onPress={() => { void run(async () => setGrant(await props.onVerifyChallenge(challenge.challengeId, code))); }} />
          <SecondaryButton label="重新获取验证码" onPress={() => { setChallenge(null); setCode(""); setError(null); }} />
        </View> : <View style={{ gap: theme.space.md }}>
          <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>
            {localJournalDeleted ? "本机手记已删除" : "请选择本机手记的处理方式"}
          </Text>
          {!localJournalDeleted ? <Text selectable style={{ ...theme.typography.body, color: theme.color.error }}>
            {props.journalPersistence === "plaintext-sqlite"
              ? "当前是 Expo Go 开发预览；若保留，手记仍在本机明文 SQLite 中，删除云端账户后内容保持锁定。卸载 Expo Go、清除项目数据或主动删除后不可恢复。"
              : props.journalPersistence === "memory-only"
                ? "当前手记只存在于本次内存会话，关闭 App 后即会丢失，无法持久保留。"
                : "若保留，手记仍仅保存在本机，并以加密状态保持锁定；删除账户后将无法再解锁。"}
          </Text> : null}
          {localJournalDeleted ? <Text selectable style={{ ...theme.typography.body, color: theme.color.error }}>
            {localCleanupPending
              ? "本机处理已不可更改；请先完成安全清理，再删除云端账户。"
              : "本机处理已不可更改；现在只能继续删除云端账户。"}
          </Text> : <>
            <SecondaryButton label="保留本机手记" onPress={() => { setJournalChoice("keep"); setError(null); }} />
            <SecondaryButton label="永久删除本机手记" onPress={() => { setJournalChoice("delete"); setError(null); }} />
          </>}
          {!localJournalDeleted && journalChoice === "keep" ? <Text selectable style={{ ...theme.typography.body, color: theme.color.textMuted }}>
            {props.journalPersistence === "plaintext-sqlite"
              ? "已选择：保留当前账户的本机明文手记。这些内容不会上传；删除云端账户后会保持锁定。"
              : props.journalPersistence === "memory-only"
                ? "已选择：仅在当前内存会话中暂时保留；关闭 App 后内容会丢失。"
                : "已选择：保留当前账户的本机手记。这些内容不会上传，删除账户后也无法恢复访问。"}
          </Text> : null}
          {!localJournalDeleted && journalChoice === "delete" ? <Text selectable style={{ ...theme.typography.body, color: theme.color.error }}>
            已选择：先永久删除当前账户的本机手记，再删除云端账户。其他账户的本机手记不受影响。
          </Text> : null}
          {journalChoice !== null ? <Button
            label={localCleanupPending
              ? "完成安全清理并删除云端账户"
              : localJournalDeleted
                ? "继续删除云端账户"
              : journalChoice === "delete"
                ? "删除手记并删除云端账户"
                : "确认删除云端账户"}
            loading={pending}
            onPress={() => { void deleteAccount(); }}
          /> : null}
          <SecondaryButton label="取消" onPress={props.onBack} />
        </View>}
        {error?.kind === "auth" ? <Text accessibilityRole="alert" selectable style={{ ...theme.typography.body, color: theme.color.error }}>{error.message}</Text> : null}
        {error?.kind === "local" ? <Text accessibilityRole="alert" selectable style={{ ...theme.typography.body, color: theme.color.error }}>本机手记未能删除，云端账户保持不变。请重试。</Text> : null}
        {error?.kind === "local-cleanup" ? <Text accessibilityRole="alert" selectable style={{ ...theme.typography.body, color: theme.color.error }}>
          {localJournalDeleted
            ? "本机手记已从 App 中删除，但安全清理尚未完成。请重试后再删除云端账户。"
            : "本机有已删除内容的安全清理尚未完成。请重试后再删除云端账户。"}
        </Text> : null}
        {error?.kind === "local-check" ? <Text accessibilityRole="alert" selectable style={{ ...theme.typography.body, color: theme.color.error }}>无法确认本机手记删除状态。为保护本机数据，暂不能删除云端账户。请重试。</Text> : null}
        {error?.kind === "cloud-after-local" ? <Text accessibilityRole="alert" selectable style={{ ...theme.typography.body, color: theme.color.error }}>本机手记已删除，但云端账户未能删除。请重试云端删除。</Text> : null}
      </Card>
    </ScrollView>
  );
}

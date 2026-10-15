import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { StatusBanner } from "../../../core/ui/StatusBanner";
import {
  emptyPreferenceCard,
  normalizePreferenceCard,
  PREFERENCE_CARD_FIELDS,
  type PreferenceCard,
  type PreferenceCardField,
  type PreferenceCardRepository,
} from "../preference-card";

type PreferenceCardEditorProps = {
  ownerId: string;
  repository: PreferenceCardRepository;
  persistence: "memory-only" | "sqlcipher-secure-store";
  onDirtyChange?(dirty: boolean): void;
};

function cardEquals(left: PreferenceCard, right: PreferenceCard) {
  return PREFERENCE_CARD_FIELDS.every(({ id }) => left[id] === right[id]);
}

export function PreferenceCardEditor({ ownerId, repository, persistence, onDirtyChange }: PreferenceCardEditorProps) {
  const theme = useTheme();
  const [card, setCard] = useState<PreferenceCard>(emptyPreferenceCard);
  const [saved, setSaved] = useState<PreferenceCard | null>(null);
  const [hasSavedCard, setHasSavedCard] = useState(false);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const savingRef = useRef(false);
  const [retry, setRetry] = useState(0);
  const dirty = loadState === "ready" && (saved === null || !cardEquals(saved, normalizePreferenceCard(card)));

  useEffect(() => {
    let active = true;
    setLoadState("loading");
    void repository.load(ownerId).then((loaded) => {
      if (!active) return;
      const restored = loaded ?? emptyPreferenceCard();
      setCard(restored);
      setSaved(restored);
      setHasSavedCard(loaded !== null);
      setLoadState("ready");
      setSaveState("idle");
    }).catch(() => { if (active) setLoadState("error"); });
    return () => { active = false; };
  }, [ownerId, repository, retry]);

  const edit = useCallback((field: PreferenceCardField, value: string) => {
    const updated = { ...card, [field]: value };
    setCard(updated);
    onDirtyChange?.(saved === null || !cardEquals(saved, normalizePreferenceCard(updated)));
    setSaveState("idle");
  }, [card, onDirtyChange, saved]);

  const save = async () => {
    if (savingRef.current || loadState !== "ready") return;
    const normalized = normalizePreferenceCard(card);
    if (saved !== null && cardEquals(saved, normalized)) return;
    savingRef.current = true;
    setSaveState("saving");
    try {
      await repository.save(ownerId, normalized);
      setCard(normalized);
      setSaved(normalized);
      setHasSavedCard(true);
      onDirtyChange?.(false);
      setSaveState("success");
    } catch {
      setSaveState("error");
    } finally {
      savingRef.current = false;
    }
  };

  if (loadState === "loading") return (
    <View accessibilityLiveRegion="polite" style={{ alignItems: "center", gap: theme.space.sm, padding: theme.space.lg }}>
      <ActivityIndicator color={theme.color.primary} />
      <Text style={{ ...theme.typography.body, color: theme.color.textSecondary }}>正在读取本机偏好卡…</Text>
    </View>
  );

  if (loadState === "error") return (
    <StatusBanner
      actionLabel="重试读取"
      message="暂时无法读取偏好卡，请重试。"
      onAction={() => setRetry((current) => current + 1)}
      variant="error"
    />
  );

  return (
    <View style={{ gap: theme.space.md }}>
      <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
        {persistence === "memory-only"
          ? "当前为演示模式，偏好卡只保留到本次应用会话结束。"
          : "偏好卡加密保存在本机，不会自动分享。每项可留空，也可以写“还不确定”。"}
      </Text>
      {PREFERENCE_CARD_FIELDS.map(({ id, title }) => (
        <View key={id} style={{ gap: theme.space.xs }}>
          <Text style={{ ...theme.typography.label, color: theme.color.text }}>{title}</Text>
          <TextInput
            accessibilityLabel={title}
            editable={saveState !== "saving"}
            maxLength={300}
            multiline
            onChangeText={(value) => edit(id, value)}
            placeholder="可留空，或写下现在的想法"
            placeholderTextColor={theme.color.textSecondary}
            style={{
              ...theme.typography.body,
              backgroundColor: theme.color.surface,
              borderColor: theme.color.border,
              borderRadius: theme.radius.control,
              borderWidth: theme.border.width,
              color: theme.color.text,
              minHeight: 72,
              padding: theme.space.md,
              textAlignVertical: "top",
            }}
            value={card[id]}
          />
        </View>
      ))}
      {saveState === "error" ? <StatusBanner message="保存失败，当前画面的文字仍在。请重试。" variant="error" /> : null}
      {saveState === "success" ? <StatusBanner message="偏好卡已保存在本机，可随时回来修改。" variant="success" /> : null}
      <Button
        disabled={!dirty}
        label={saveState === "saving" ? "正在保存…" : hasSavedCard ? "保存更改" : "保存偏好卡"}
        loading={saveState === "saving"}
        onPress={() => { void save(); }}
      />
      {hasSavedCard && saved !== null && PREFERENCE_CARD_FIELDS.some(({ id }) => saved[id].length > 0) ? (
        <View style={{
          backgroundColor: theme.color.surfaceAccent,
          borderColor: theme.color.borderSoft,
          borderRadius: theme.radius.feature,
          borderWidth: theme.border.width,
          gap: theme.space.md,
          padding: theme.space.lg,
        }}>
          <Text style={{ ...theme.typography.heading, color: theme.color.text }}>我的个人偏好卡</Text>
          <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>仅自己可见 · 随时可修改 · 不代表预先同意</Text>
          {PREFERENCE_CARD_FIELDS.filter(({ id }) => saved[id].length > 0).map(({ id, title }) => (
            <View key={id} style={{ gap: theme.space.xs }}>
              <Text style={{ ...theme.typography.label, color: theme.color.text }}>{title}</Text>
              <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>{saved[id]}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

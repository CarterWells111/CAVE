import { useRef, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { theme } from "../../../core/design/theme";
import { Button } from "../../../core/ui/Button";
import { Card } from "../../../core/ui/Card";
import { InfoCard } from "../../../core/ui/info-card";
import { SecondaryButton } from "../../../core/ui/secondary-button";
import { StatusBanner } from "../../../core/ui/StatusBanner";

export type EditableConfirmedCardSection = Readonly<{
  id: string;
  title: string;
  text: string;
}>;

export type SavedCardEditMetadata = Readonly<{
  id: string;
  title: string;
  dateLabel: string;
  statusLabel: string;
}>;

export type SavedCardEditScreenProps = {
  metadata: SavedCardEditMetadata;
  confirmedSections: readonly EditableConfirmedCardSection[];
  onSave(sections: readonly EditableConfirmedCardSection[]): Promise<void>;
  onCancel(): void;
};

type SaveState = "idle" | "saving" | "error" | "success";

export function SavedCardEditScreen({
  confirmedSections,
  metadata,
  onCancel,
  onSave
}: SavedCardEditScreenProps) {
  const [sections, setSections] = useState<EditableConfirmedCardSection[]>(() => confirmedSections.map(
    ({ id, text, title }) => ({ id, text, title })
  ));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [invalidIds, setInvalidIds] = useState<ReadonlySet<string>>(() => new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const saveInFlight = useRef(false);
  const saving = saveState === "saving";

  const updateSection = (id: string, text: string) => {
    setSections((current) => current.map((section) => section.id === id ? { ...section, text } : section));
    setInvalidIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    if (saveState !== "saving") setSaveState("idle");
  };

  const save = async () => {
    if (saveInFlight.current) return;
    const blankIds = sections.filter(({ text }) => text.trim().length === 0).map(({ id }) => id);
    if (blankIds.length > 0) {
      setInvalidIds(new Set(blankIds));
      setSaveState("idle");
      return;
    }
    const updated = sections.map(({ id, text, title }) => ({ id, title, text: text.trim() }));
    saveInFlight.current = true;
    setSaveState("saving");
    try {
      await onSave(updated);
      setSections(updated);
      setSaveState("success");
    } catch {
      setSaveState("error");
    } finally {
      saveInFlight.current = false;
    }
  };

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
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
      testID="saved-card-edit-scroll"
    >
      <View style={{ gap: theme.space.sm }}>
        <Text accessibilityRole="header" selectable style={{ ...theme.typography.title, color: theme.color.text }}>
          {`编辑${metadata.title}`}
        </Text>
        <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
          {`${metadata.dateLabel} · ${metadata.statusLabel}`}
        </Text>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
          这里只编辑已经明确加入卡片的内容。
        </Text>
      </View>

      {sections.length > 0 ? sections.map((section) => {
        const invalid = invalidIds.has(section.id);
        const focused = focusedId === section.id;
        return (
          <Card accessible={false} key={section.id}>
            <Text accessibilityRole="header" selectable style={{ ...theme.typography.cardTitle, color: theme.color.text }}>
              {section.title}
            </Text>
            <TextInput
              accessibilityHint={invalid ? "此段不能为空。" : "编辑已加入卡片的文字。"}
              accessibilityLabel={`编辑：${section.title}`}
              accessibilityState={{ disabled: saving }}
              editable={!saving}
              multiline
              onBlur={() => setFocusedId((current) => current === section.id ? null : current)}
              onChangeText={(text) => updateSection(section.id, text)}
              onFocus={() => setFocusedId(section.id)}
              style={{
                ...theme.typography.body,
                backgroundColor: theme.color.surfaceMuted,
                borderColor: invalid ? theme.color.error : focused ? theme.color.focus : theme.color.interactiveBorder,
                borderCurve: "continuous",
                borderRadius: theme.radius.control,
                borderWidth: invalid || focused ? theme.border.focusWidth : theme.border.width,
                color: theme.color.text,
                minHeight: theme.size.primaryActionHeight,
                paddingHorizontal: theme.space.md,
                paddingVertical: theme.space.compact,
                textAlignVertical: "top",
                width: "100%"
              }}
              value={section.text}
            />
            {invalid ? (
              <Text accessibilityRole="alert" selectable style={{ ...theme.typography.caption, color: theme.color.error }}>
                {`${section.title}不能为空；请填写内容后再保存。`}
              </Text>
            ) : null}
          </Card>
        );
      }) : (
        <InfoCard title="没有可编辑的已确认内容">
          <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
            返回卡片后，可以先选择要加入的部分。
          </Text>
        </InfoCard>
      )}

      {saveState === "error" ? (
        <StatusBanner
          actionLabel="重试保存"
          message="保存失败，请重试。你的编辑仍保留在当前画面。"
          onAction={() => { void save(); }}
          variant="error"
        />
      ) : null}
      {saveState === "success" ? <StatusBanner message="更改已保存。" variant="success" /> : null}

      <View style={{ gap: theme.space.md }}>
        {saveState === "success" ? (
          <Button label="完成编辑" onPress={onCancel} />
        ) : (
          <Button
            disabled={sections.length === 0}
            label={saving ? "正在保存更改…" : "保存更改"}
            loading={saving}
            onPress={() => { void save(); }}
          />
        )}
        {saveState !== "success" ? (
          <SecondaryButton disabled={saving} label="取消编辑" onPress={onCancel} />
        ) : null}
      </View>
    </ScrollView>
  );
}

import { useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Card } from "../../../core/ui/Card";
import { ChoiceChip } from "../../../core/ui/ChoiceChip";
import { Screen } from "../../../core/ui/Screen";
import { SecondaryButton } from "../../../core/ui/secondary-button";
import { StatusBanner } from "../../../core/ui/StatusBanner";
import type { SharingVisibility } from "../../journey/domain/types";
import type {
  EditableSavedCardSection,
  SavedCardSectionUpdate,
} from "../application/saved-card-edit";

export type { EditableSavedCardSection, SavedCardSectionUpdate } from "../application/saved-card-edit";

export type SavedCardEditMetadata = Readonly<{
  id: string;
  title: string;
  dateLabel: string;
  statusLabel: string;
}>;

export type SavedCardEditScreenProps = {
  metadata: SavedCardEditMetadata;
  sections: readonly EditableSavedCardSection[];
  onSave(updates: readonly SavedCardSectionUpdate[]): Promise<void>;
  onCancel(): void;
};

type SaveState = "idle" | "saving" | "error" | "success";

const VISIBILITY_LABELS: Readonly<Record<SharingVisibility, string>> = {
  pending: "尚未决定",
  included: "已加入展示",
  private: "只留给自己",
  deleted: "已删除，可恢复",
};

const VISIBILITY_CHOICES = [
  { label: "加入展示", visibility: "included" },
  { label: "只留给自己", visibility: "private" },
  { label: "删除这一段", visibility: "deleted" },
] as const;

function baselineById(sections: readonly EditableSavedCardSection[]) {
  return new Map(sections.map((section) => [section.id, {
    text: section.text,
    visibility: section.visibility,
  }]));
}

export function SavedCardEditScreen({
  sections: initialSections,
  metadata,
  onCancel,
  onSave
}: SavedCardEditScreenProps) {
  const theme = useTheme();
  const [sections, setSections] = useState<EditableSavedCardSection[]>(() => initialSections.map(
    (section) => ({ ...section })
  ));
  const baselineRef = useRef(baselineById(initialSections));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [invalidIds, setInvalidIds] = useState<ReadonlySet<string>>(() => new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const saveInFlight = useRef(false);
  const saving = saveState === "saving";

  const isDirty = (section: EditableSavedCardSection) => {
    const baseline = baselineRef.current.get(section.id);
    return baseline?.text !== section.text || baseline.visibility !== section.visibility;
  };
  const hasChanges = sections.some(isDirty);

  const updateSection = (
    id: EditableSavedCardSection["id"],
    update: Partial<Pick<EditableSavedCardSection, "text" | "visibility">>,
  ) => {
    setSections((current) => current.map((section) => section.id === id ? { ...section, ...update } : section));
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
    const blankIds = sections
      .filter(({ text, visibility }) => visibility !== "deleted" && text.trim().length === 0)
      .map(({ id }) => id);
    if (blankIds.length > 0) {
      setInvalidIds(new Set(blankIds));
      setSaveState("idle");
      return;
    }
    const normalized = sections.map((section) => ({ ...section, text: section.text.trim() }));
    const updates = normalized.filter(isDirty).map(({ id, text, visibility }) => ({ id, text, visibility }));
    if (updates.length === 0) return;
    saveInFlight.current = true;
    setSaveState("saving");
    try {
      await onSave(updates);
      const updatedIds = new Set(updates.map(({ id }) => id));
      const savedSections = normalized.map((section) => updatedIds.has(section.id)
        ? { ...section, needsReview: false }
        : section);
      baselineRef.current = baselineById(savedSections);
      setSections(savedSections);
      setSaveState("success");
    } catch {
      setSaveState("error");
    } finally {
      saveInFlight.current = false;
    }
  };

  return (
    <Screen
      contentContainerStyle={{ gap: theme.space.xl }}
      keyboardDismissMode="interactive"
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
          修改文字，并决定每一段是加入展示、只留给自己，还是从这张卡中删除。
        </Text>
      </View>

      {sections.map((section) => {
        const invalid = invalidIds.has(section.id);
        const focused = focusedId === section.id;
        return (
          <Card accessible={false} key={section.id}>
            <Text accessibilityRole="header" selectable style={{ ...theme.typography.cardTitle, color: theme.color.text }}>
              {section.title}
            </Text>
            <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
              {VISIBILITY_LABELS[section.visibility]}
            </Text>
            {section.needsReview ? (
              <Text selectable style={{ ...theme.typography.caption, color: theme.color.warning }}>
                内容已变化，需要重新确认
              </Text>
            ) : null}
            <TextInput
              accessibilityHint={invalid ? "此段不能为空。" : "编辑这段沟通卡文字。"}
              accessibilityLabel={`编辑：${section.title}`}
              accessibilityState={{ disabled: saving }}
              editable={!saving}
              multiline
              onBlur={() => setFocusedId((current) => current === section.id ? null : current)}
              onChangeText={(text) => updateSection(section.id, { text })}
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
            <View accessibilityRole="radiogroup" style={{ gap: theme.space.sm }}>
              {VISIBILITY_CHOICES.map(({ label, visibility }) => (
                <ChoiceChip
                  accessibilityLabel={`${label}：${section.title}`}
                  disabled={saving}
                  key={visibility}
                  label={label}
                  onPress={() => updateSection(section.id, { visibility })}
                  selected={section.visibility === visibility}
                  semantics="radio"
                />
              ))}
            </View>
          </Card>
        );
      })}

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
            disabled={!hasChanges}
            label={saving ? "正在保存更改…" : "保存沟通卡"}
            loading={saving}
            onPress={() => { void save(); }}
          />
        )}
        {saveState !== "success" ? (
          <SecondaryButton disabled={saving} label="取消编辑" onPress={onCancel} />
        ) : null}
      </View>
    </Screen>
  );
}

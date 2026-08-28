import { useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { SecondaryButton } from "../../../core/ui/secondary-button";
import { StatusBanner } from "../../../core/ui/StatusBanner";
import type { CommunicationSectionId } from "../../journey/domain/types";
import {
  CommunicationDraftGrid,
  type CommunicationDraftGridSection
} from "../../journey/ui/components/CommunicationDraftGrid";

export type EditableCommunicationDraftSection = CommunicationDraftGridSection;

export type SavedCardEditMetadata = Readonly<{
  id: string;
  title: string;
  dateLabel: string;
  statusLabel: string;
}>;

export type SavedCardEditScreenProps = {
  metadata: SavedCardEditMetadata;
  sections: readonly EditableCommunicationDraftSection[];
  onSave(sections: readonly EditableCommunicationDraftSection[]): Promise<void>;
  onCancel(): void;
};

type SaveState = "idle" | "saving" | "error" | "success";

export function SavedCardEditScreen({ metadata, onCancel, onSave, sections: initialSections }: SavedCardEditScreenProps) {
  const theme = useTheme();
  const [sections, setSections] = useState<EditableCommunicationDraftSection[]>(() => initialSections.map((section) => ({ ...section })));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveInFlight = useRef(false);
  const saving = saveState === "saving";

  const edit = (id: CommunicationSectionId, text: string) => {
    setSections((current) => current.map((section) => section.id === id
      ? { ...section, text, needsReview: false }
      : section));
    setSaveState("idle");
  };
  const setDeleted = (id: CommunicationSectionId, deleted: boolean) => {
    setSections((current) => current.map((section) => section.id === id ? { ...section, deleted } : section));
    setSaveState("idle");
  };
  const save = async () => {
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setSaveState("saving");
    try {
      await onSave(sections.map((section) => ({ ...section, text: section.text.trim() })));
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
          编辑沟通草稿
        </Text>
        <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
          {`${metadata.dateLabel} · ${metadata.statusLabel}`}
        </Text>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
          七段内容会一直保留在本机记录中。灰色段落不会出现在卡纸里，但可以随时编辑并恢复。
        </Text>
      </View>

      <CommunicationDraftGrid
        disabled={saving}
        onEdit={edit}
        onSetDeleted={setDeleted}
        sections={sections}
      />

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
          <Button label={saving ? "正在保存更改…" : "保存更改"} loading={saving} onPress={() => { void save(); }} />
        )}
        {saveState !== "success" ? <SecondaryButton disabled={saving} label="取消编辑" onPress={onCancel} /> : null}
      </View>
    </ScrollView>
  );
}

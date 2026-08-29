import { useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { SecondaryButton } from "../../../core/ui/secondary-button";
import { StatusBanner } from "../../../core/ui/StatusBanner";
import type { CommunicationSectionId, SharingVisibility } from "../../journey/domain/types";
import {
  CommunicationDraftGrid,
  type CommunicationDraftGridSection
} from "../../journey/ui/components/CommunicationDraftGrid";
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

function baselineById(sections: readonly EditableSavedCardSection[]) {
  return new Map(sections.map((section) => [section.id, {
    text: section.text,
    visibility: section.visibility,
  }]));
}

function retainedVisibilityById(sections: readonly EditableSavedCardSection[]) {
  return new Map<CommunicationSectionId, Exclude<SharingVisibility, "deleted">>(sections.map((section) => [
    section.id,
    section.visibility === "deleted" ? "pending" : section.visibility,
  ]));
}

export function SavedCardEditScreen({
  metadata,
  onCancel,
  onSave,
  sections: initialSections
}: SavedCardEditScreenProps) {
  const theme = useTheme();
  const [sections, setSections] = useState<EditableSavedCardSection[]>(() => initialSections.map((section) => ({ ...section })));
  const baselineRef = useRef(baselineById(initialSections));
  const retainedVisibilityRef = useRef(retainedVisibilityById(initialSections));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveInFlight = useRef(false);
  const saving = saveState === "saving";

  const isDirty = (section: EditableSavedCardSection) => {
    const baseline = baselineRef.current.get(section.id);
    return baseline?.text !== section.text || baseline.visibility !== section.visibility;
  };
  const hasChanges = sections.some(isDirty);

  const edit = (id: CommunicationSectionId, text: string) => {
    setSections((current) => current.map((section) => section.id === id
      ? { ...section, text, needsReview: false }
      : section));
    setSaveState("idle");
  };

  const setDeleted = (id: CommunicationSectionId, deleted: boolean) => {
    setSections((current) => current.map((section) => {
      if (section.id !== id) return section;
      if (deleted) {
        if (section.visibility !== "deleted") retainedVisibilityRef.current.set(id, section.visibility);
        return { ...section, visibility: "deleted" };
      }
      return { ...section, visibility: retainedVisibilityRef.current.get(id) ?? "pending" };
    }));
    setSaveState("idle");
  };

  const save = async () => {
    if (saveInFlight.current) return;
    const normalized = sections.map((section) => ({ ...section, text: section.text.trim() }));
    const hasBlankRetainedSection = normalized.some(
      ({ text, visibility }) => visibility !== "deleted" && text.length === 0
    );
    if (hasBlankRetainedSection) return;
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
      retainedVisibilityRef.current = retainedVisibilityById(savedSections);
      setSections(savedSections);
      setSaveState("success");
    } catch {
      setSaveState("error");
    } finally {
      saveInFlight.current = false;
    }
  };

  const gridSections: CommunicationDraftGridSection[] = sections.map((section) => ({
    id: section.id,
    title: section.title,
    text: section.text,
    deleted: section.visibility === "deleted",
    needsReview: section.needsReview,
  }));

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
      style={{ backgroundColor: theme.color.background }}
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
          七段内容会一直保留在本机记录中。灰色段落不会出现在草稿卡纸里，但可以随时编辑并恢复。
        </Text>
      </View>

      <CommunicationDraftGrid
        disabled={saving}
        onEdit={edit}
        onSetDeleted={setDeleted}
        sections={gridSections}
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
          <Button
            disabled={!hasChanges}
            label={saving ? "正在保存更改…" : "保存更改"}
            loading={saving}
            onPress={() => { void save(); }}
          />
        )}
        {saveState !== "success" ? <SecondaryButton disabled={saving} label="取消编辑" onPress={onCancel} /> : null}
      </View>
    </ScrollView>
  );
}

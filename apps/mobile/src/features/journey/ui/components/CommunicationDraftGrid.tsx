import { useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { useTheme } from "../../../../core/design/theme-provider";
import { BottomSheet } from "../../../../core/ui/bottom-sheet";
import { Button } from "../../../../core/ui/Button";
import { Card } from "../../../../core/ui/Card";
import { SecondaryButton } from "../../../../core/ui/secondary-button";
import { TextAction } from "../../../../core/ui/text-action";
import type { CommunicationSectionId } from "../../domain/types";

export type CommunicationDraftGridSection = Readonly<{
  id: CommunicationSectionId;
  title: string;
  text: string;
  deleted: boolean;
  needsReview?: boolean;
}>;

type Props = Readonly<{
  sections: readonly CommunicationDraftGridSection[];
  dense?: boolean;
  disabled?: boolean;
  onEdit(sectionId: CommunicationSectionId, text: string): void | Promise<void>;
  onSetDeleted(sectionId: CommunicationSectionId, deleted: boolean): void | Promise<void>;
}>;

function pairs<T>(items: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += 2) rows.push(items.slice(index, index + 2));
  return rows;
}

export function CommunicationDraftGrid({ dense = false, disabled = false, onEdit, onSetDeleted, sections }: Props) {
  const theme = useTheme();
  const [editingId, setEditingId] = useState<CommunicationSectionId>();
  const [editingText, setEditingText] = useState("");
  const [editingError, setEditingError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const editorReturnFocusRef = useRef<View>(null);
  const editorInputRef = useRef<TextInput>(null);
  const editorTriggerRefs = useRef(new Map<CommunicationSectionId, View | null>());
  const editingSection = sections.find(({ id }) => id === editingId);

  const openEditor = (section: CommunicationDraftGridSection) => {
    if (disabled) return;
    editorReturnFocusRef.current = editorTriggerRefs.current.get(section.id) ?? null;
    setEditingId(section.id);
    setEditingText(section.text);
    setEditingError(undefined);
  };
  const closeEditor = () => {
    if (saving) return;
    setEditingId(undefined);
    setEditingText("");
    setEditingError(undefined);
  };
  const saveEdit = async () => {
    if (editingId === undefined || saving) return;
    const text = editingText.trim();
    if (text.length === 0) {
      setEditingError("内容不能为空；如果这次不想保留，可以从草稿中删除。");
      return;
    }
    setSaving(true);
    setEditingError(undefined);
    try {
      await onEdit(editingId, text);
      setEditingId(undefined);
      setEditingText("");
    } catch {
      setEditingError("保存编辑失败，请重试。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <View style={{ gap: theme.space.sm }} testID="communication-draft-grid">
        {(dense ? sections.map((section) => [section]) : pairs(sections)).map((row, rowIndex) => (
          <View
            key={`draft-row-${rowIndex}`}
            style={{ alignItems: "stretch", flexDirection: "row", gap: theme.space.sm }}
            testID={`communication-draft-row-${rowIndex}`}
          >
            {row.map((section) => {
              const missingText = section.text.trim().length === 0;
              const body = missingText ? "旧记录未保存此段内容，可以先编辑文字再恢复。" : section.text;
              const textColor = section.deleted ? theme.color.disabledText : theme.color.text;
              return (
                <View key={section.id} style={{ flex: 1, minWidth: 0 }}>
                  <Card
                    accessible={false}
                    style={{
                      backgroundColor: section.deleted ? theme.color.disabled : theme.color.surface,
                      flex: 1,
                      gap: theme.space.compact,
                      padding: theme.space.compact
                    }}
                    testID={`communication-draft-card-${section.id}`}
                  >
                    <Text accessibilityRole="header" selectable style={{ ...theme.typography.cardTitle, color: textColor }}>
                      {section.title}
                    </Text>
                    {section.deleted || !dense ? (
                      <Text
                        accessibilityLiveRegion="polite"
                        selectable
                        style={{ ...theme.typography.label, color: section.deleted ? theme.color.disabledText : theme.color.textSecondary }}
                      >
                        {section.deleted ? "已从草稿中删除" : "保留在沟通草稿中"}
                      </Text>
                    ) : null}
                    {section.needsReview ? (
                      <Text selectable style={{ ...theme.typography.caption, color: theme.color.warning }}>
                        前面的回答有变化，请再检查一下这段文字。
                      </Text>
                    ) : null}
                    <Text selectable style={{ ...theme.typography.body, color: textColor, flexShrink: 1 }}>
                      {body}
                    </Text>
                    <View
                      style={dense ? {
                        alignItems: "center",
                        alignSelf: "flex-end",
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: theme.space.compact,
                        justifyContent: "flex-end",
                      } : { gap: theme.space.compact, width: "100%" }}
                      testID={dense ? `communication-draft-actions-${section.id}` : undefined}
                    >
                      {dense ? (
                        <TextAction
                          accessibilityLabel={`编辑：${section.title}`}
                          disabled={disabled || saving}
                          label="编辑"
                          onPress={() => openEditor(section)}
                          ref={(node) => { editorTriggerRefs.current.set(section.id, node); }}
                        />
                      ) : (
                        <SecondaryButton
                          accessibilityLabel={`编辑：${section.title}`}
                          disabled={disabled || saving}
                          label="编辑"
                          onPress={() => openEditor(section)}
                          ref={(node) => { editorTriggerRefs.current.set(section.id, node); }}
                        />
                      )}
                      {section.deleted ? (
                        dense ? (
                          <TextAction
                            disabled={disabled || saving || missingText}
                            accessibilityLabel={`恢复到草稿：${section.title}`}
                            label="恢复到草稿"
                            onPress={() => { void onSetDeleted(section.id, false); }}
                          />
                        ) : (
                          <Button
                            disabled={disabled || saving || missingText}
                            accessibilityLabel={`恢复到草稿：${section.title}`}
                            label="恢复到草稿"
                            onPress={() => { void onSetDeleted(section.id, false); }}
                          />
                        )
                      ) : dense ? (
                        <TextAction
                          disabled={disabled || saving}
                          accessibilityLabel={`从草稿中删除：${section.title}`}
                          label="从草稿中删除"
                          onPress={() => { void onSetDeleted(section.id, true); }}
                        />
                      ) : (
                        <SecondaryButton
                          disabled={disabled || saving}
                          accessibilityLabel={`从草稿中删除：${section.title}`}
                          label="从草稿中删除"
                          onPress={() => { void onSetDeleted(section.id, true); }}
                        />
                      )}
                    </View>
                  </Card>
                </View>
              );
            })}
            {!dense && row.length === 1 ? <View accessibilityElementsHidden style={{ flex: 1, minWidth: 0 }} /> : null}
          </View>
        ))}
      </View>

      <BottomSheet
        {...(dense ? { onInitialFocus: () => editorInputRef.current?.focus() } : {})}
        closeLabel={dense ? "取消" : "取消编辑"}
        hideHeader={dense}
        onClose={closeEditor}
        returnFocusRef={editorReturnFocusRef}
        title={dense ? "编辑沟通草稿" : editingSection ? `编辑：${editingSection.title}` : "编辑沟通草稿"}
        visible={editingSection !== undefined}
      >
        <TextInput
          ref={editorInputRef}
          accessibilityHint={editingError}
          accessibilityLabel={editingSection ? `草稿内容：${editingSection.title}` : "沟通草稿内容"}
          editable={!saving}
          multiline
          onChangeText={(text) => {
            setEditingText(text);
            if (editingError !== undefined) setEditingError(undefined);
          }}
          style={{
            ...theme.typography.body,
            backgroundColor: theme.color.surfaceMuted,
            borderColor: editingError ? theme.color.error : theme.color.interactiveBorder,
            borderRadius: theme.radius.control,
            borderWidth: editingError ? theme.border.focusWidth : theme.border.width,
            color: theme.color.text,
            minHeight: 144,
            padding: theme.space.md,
            textAlignVertical: "top"
          }}
          value={editingText}
        />
        {editingError ? (
          <Text accessibilityRole="alert" selectable style={{ ...theme.typography.caption, color: theme.color.error }}>
            {editingError}
          </Text>
        ) : null}
        <Button label={saving ? "正在保存编辑…" : "保存编辑"} loading={saving} onPress={() => { void saveEdit(); }} />
        <SecondaryButton disabled={saving} label="取消" onPress={closeEditor} />
      </BottomSheet>
    </>
  );
}

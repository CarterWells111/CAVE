import { useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Card } from "../../../core/ui/Card";
import { InfoCard } from "../../../core/ui/info-card";
import { SecondaryButton } from "../../../core/ui/secondary-button";
import { StatusBanner } from "../../../core/ui/StatusBanner";

export type ReviewDetailMetadata = Readonly<{
  id: string;
  title: string;
  dateLabel: string;
  statusLabel: string;
}>;

export type ReviewDetailSection = Readonly<{ id: string; title: string; text: string }>;

export type ReviewDetailScreenProps = {
  metadata: ReviewDetailMetadata;
  sections: readonly ReviewDetailSection[];
  onBack(): void;
  onBranch(reviewId: string): Promise<void>;
  onDelete(reviewId: string): Promise<void>;
  onContinueAfterDelete(): void;
  onSaveToJournal?(): void;
};

type DeleteState = "idle" | "confirming" | "deleting" | "error" | "success";
type BranchState = "idle" | "branching" | "error";

function DeleteButton({ label, loading = false, onPress }: { label: string; loading?: boolean; onPress(): void }) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: loading }}
      disabled={loading}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: pressed ? theme.color.surfacePressed : theme.color.dangerSurface,
        borderColor: theme.color.danger,
        borderCurve: "continuous",
        borderRadius: theme.radius.control,
        borderWidth: loading ? theme.border.selectedWidth : theme.border.width,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: theme.space.sm,
        justifyContent: "center",
        minHeight: theme.size.primaryActionHeight,
        minWidth: theme.size.minimumTouchTarget,
        outlineColor: theme.color.focus,
        outlineOffset: theme.border.focusOffset,
        outlineWidth: focused ? theme.border.focusWidth : 0,
        paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.compact,
        width: "100%"
      })}
    >
      <Text selectable style={{ ...theme.typography.button, color: theme.color.onDanger, flexShrink: 1, textAlign: "center" }}>
        {label}
      </Text>
      {loading ? (
        <Text accessibilityLiveRegion="polite" selectable style={{ ...theme.typography.caption, color: theme.color.onDanger }}>
          处理中
        </Text>
      ) : null}
    </Pressable>
  );
}

export function ReviewDetailScreen(_props: ReviewDetailScreenProps) {
  const theme = useTheme();
  const { metadata, onBack, onBranch, onContinueAfterDelete, onDelete, onSaveToJournal, sections } = _props;
  const [deleteState, setDeleteState] = useState<DeleteState>("idle");
  const [branchState, setBranchState] = useState<BranchState>("idle");
  const deletionInFlight = useRef(false);
  const branchingInFlight = useRef(false);

  const branchReview = async () => {
    if (branchingInFlight.current) return;
    branchingInFlight.current = true;
    setBranchState("branching");
    try {
      await onBranch(metadata.id);
      setBranchState("idle");
    } catch {
      setBranchState("error");
    } finally {
      branchingInFlight.current = false;
    }
  };

  const deleteReview = async () => {
    if (deletionInFlight.current) return;
    deletionInFlight.current = true;
    setDeleteState("deleting");
    try {
      await onDelete(metadata.id);
      setDeleteState("success");
    } catch {
      setDeleteState("error");
    } finally {
      deletionInFlight.current = false;
    }
  };

  const deleting = deleteState === "deleting";
  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={{
        alignItems: "center",
        gap: theme.space.xl,
        paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.xl
      }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      testID="review-detail-scroll"
    >
      <View style={{ gap: theme.space.xl, maxWidth: theme.size.readableContentMax, minWidth: 0, width: "100%" }}>
        {deleteState === "success" ? (
          <View style={{ gap: theme.space.lg }}>
            <StatusBanner message="这条回顾已删除。" variant="success" />
            <Button label="返回我的回顾" onPress={onContinueAfterDelete} />
          </View>
        ) : (
          <>
            <View style={{ gap: theme.space.sm }}>
              <Text accessibilityRole="header" selectable style={{ ...theme.typography.title, color: theme.color.text }}>
                {metadata.title}
              </Text>
              <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
                {`${metadata.dateLabel} · ${metadata.statusLabel}`}
              </Text>
            </View>

            <View style={{ gap: theme.space.md }}>
              {sections.length > 0 ? sections.map((section) => (
                <Card accessible={false} key={section.id}>
                  <Text accessibilityRole="header" selectable style={{ ...theme.typography.cardTitle, color: theme.color.text }}>
                    {section.title}
                  </Text>
                  <Text selectable style={{ ...theme.typography.body, color: theme.color.text, flexShrink: 1 }}>
                    {section.text}
                  </Text>
                </Card>
              )) : (
                <InfoCard title="这条回顾没有正文">
                  <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
                    仍可返回历史列表或从这条记录开始新的分支。
                  </Text>
                </InfoCard>
              )}
            </View>

            <View style={{ gap: theme.space.md }}>
              {branchState === "error" ? <StatusBanner message="新分支保存失败，原回顾和当前草稿都没有改变。请重试。" variant="error" /> : null}
              <Button
                disabled={deleting || deleteState !== "idle" || branchState === "branching"}
                label={branchState === "branching" ? "正在创建新分支…" : branchState === "error" ? "重试创建新分支" : "从这条回顾开始新分支"}
                onPress={() => { void branchReview(); }}
              />
              <SecondaryButton disabled={deleting || branchState === "branching"} label="返回我的回顾" onPress={onBack} />
              {onSaveToJournal ? <SecondaryButton disabled={deleting || branchState === "branching"} label="保存到内界手记" onPress={onSaveToJournal} /> : null}
            </View>

            <Card accessible={false} style={{ borderColor: theme.color.danger }}>
              <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>
                删除这条回顾
              </Text>
              {deleteState === "idle" ? <DeleteButton label="删除这条回顾" loading={branchState === "branching"} onPress={() => setDeleteState("confirming")} /> : null}
              {deleteState === "confirming" ? (
                <View style={{ gap: theme.space.md }}>
                  <Text accessibilityRole="alert" selectable style={{ ...theme.typography.body, color: theme.color.error }}>
                    请再次确认：这条回顾会从本机删除，并且无法恢复。
                  </Text>
                  <DeleteButton label="确认删除这条回顾" loading={branchState === "branching"} onPress={() => { void deleteReview(); }} />
                  <SecondaryButton disabled={branchState === "branching"} label="取消删除" onPress={() => setDeleteState("idle")} />
                </View>
              ) : null}
              {deleteState === "deleting" ? (
                <View accessibilityLiveRegion="polite" style={{ gap: theme.space.sm }}>
                  <DeleteButton label="正在删除这条回顾…" loading onPress={() => undefined} />
                  <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
                    完成前请留在当前画面。
                  </Text>
                </View>
              ) : null}
              {deleteState === "error" ? (
                <View style={{ gap: theme.space.md }}>
                  <StatusBanner message="删除失败，请重试。回顾内容仍保留在当前画面。" variant="error" />
                  <DeleteButton label="重试删除" loading={branchState === "branching"} onPress={() => { void deleteReview(); }} />
                  <SecondaryButton disabled={branchState === "branching"} label="取消删除" onPress={() => setDeleteState("idle")} />
                </View>
              ) : null}
            </Card>
          </>
        )}
      </View>
    </ScrollView>
  );
}

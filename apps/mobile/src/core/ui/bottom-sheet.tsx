import { useEffect, useRef, type PropsWithChildren } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../design/theme-provider";
import { TextAction } from "./text-action";

export type BottomSheetProps = PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
  onInitialFocus?: () => void;
  onRestoreFocus?: () => void;
  closeLabel?: string;
  dismissible?: boolean;
  reducedMotion?: boolean;
  resolveFocusHandle?: typeof findNodeHandle;
}>;

export function BottomSheet({
  children,
  visible,
  title,
  onClose,
  onInitialFocus,
  onRestoreFocus,
  closeLabel = `关闭${title}`,
  dismissible = true,
  reducedMotion = false,
  resolveFocusHandle = findNodeHandle,
}: BottomSheetProps) {
  const theme = useTheme();
  const wasVisible = useRef(false);
  const closeRef = useRef<View>(null);
  const titleRef = useRef<Text>(null);

  useEffect(() => {
    if (wasVisible.current && !visible) onRestoreFocus?.();
    wasVisible.current = visible;
  }, [onRestoreFocus, visible]);

  const handleShow = () => {
    const focusTarget = dismissible ? closeRef.current : titleRef.current;
    const focusNode = resolveFocusHandle(focusTarget);
    if (focusNode !== null) AccessibilityInfo.setAccessibilityFocus(focusNode);
    onInitialFocus?.();
  };

  const handleDismiss = () => {
    if (dismissible) onClose();
  };

  return (
    <Modal
      animationType={reducedMotion ? "none" : "slide"}
      onRequestClose={handleDismiss}
      onShow={handleShow}
      testID="bottom-sheet-modal"
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "flex-end" }}
      >
        <SafeAreaView
          edges={["bottom"]}
          style={{
            backgroundColor: theme.color.canvasRaised,
            borderCurve: "continuous",
            borderTopLeftRadius: theme.radius.sheet,
            borderTopRightRadius: theme.radius.sheet,
            maxHeight: "78%",
            width: "100%",
          }}
          testID="bottom-sheet-safe-area"
        >
          <View
            accessibilityLabel={title}
            accessibilityViewIsModal
            onAccessibilityEscape={handleDismiss}
            style={{ flexShrink: 1, paddingHorizontal: theme.space.card, paddingTop: theme.space.md }}
            testID="bottom-sheet-panel"
          >
            <View style={{ alignItems: "center", flexDirection: "row", gap: theme.space.sm, justifyContent: "space-between" }}>
              <Text ref={titleRef} accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text, flex: 1, flexShrink: 1 }}>
                {title}
              </Text>
              {dismissible ? <TextAction ref={closeRef} label={closeLabel} onPress={handleDismiss} /> : null}
            </View>
            <ScrollView
              automaticallyAdjustKeyboardInsets
              contentContainerStyle={{ gap: theme.space.md, paddingBottom: theme.space.card, paddingTop: theme.space.compact }}
              horizontal={false}
              keyboardShouldPersistTaps="handled"
              testID="bottom-sheet-scroll"
            >
              {children}
            </ScrollView>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

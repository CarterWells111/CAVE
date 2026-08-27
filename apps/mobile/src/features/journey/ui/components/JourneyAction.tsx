import { useEffect, useRef, useState } from "react";
import type { AccessibilityRole, AccessibilityState } from "react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type {
  JourneyAction as JourneyActionCallback,
  JourneyAsyncState
} from "../journey-ui-contracts";
import { journeyColors, journeyRadii, journeySizes, journeySpacing } from "../journey-ui-tokens";
import { JourneyStatusBanner } from "./JourneyStatusBanner";

export type JourneyActionProps = {
  label: string;
  loadingLabel: string;
  onAction?: JourneyActionCallback | undefined;
  disabled?: boolean | undefined;
  selected?: boolean | undefined;
  role?: AccessibilityRole | undefined;
  state?: AccessibilityState | undefined;
  actionState?: JourneyAsyncState | undefined;
  errorMessage?: string | undefined;
  accessibilityLabel?: string | undefined;
  testID?: string | undefined;
};

const GENERIC_ACTION_ERROR = "操作失败，请重试。";

export function JourneyAction({
  label,
  loadingLabel,
  onAction,
  disabled = false,
  selected = false,
  role = "button",
  state,
  actionState,
  errorMessage,
  accessibilityLabel,
  testID
}: JourneyActionProps) {
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const previousExternalStatusRef = useRef(actionState?.status);
  const [internalState, setInternalState] = useState<JourneyAsyncState>({ status: "idle" });
  const externallyLoading = actionState?.status === "loading";
  const loading = externallyLoading || internalState.status === "loading";
  const unavailable = disabled || !onAction || loading;
  const checked = role === "checkbox" || role === "radio" ? selected : state?.checked;
  const accessibilityState: AccessibilityState = {
    ...state,
    busy: loading,
    checked,
    disabled: unavailable,
    selected
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      inFlightRef.current = false;
    };
  }, []);

  useEffect(() => {
    const externalStatus = actionState?.status;
    if (externalStatus === "loading" && previousExternalStatusRef.current !== "loading") {
      setInternalState({ status: "idle" });
    }
    previousExternalStatusRef.current = externalStatus;
  }, [actionState?.status]);

  const settleInternalState = (nextState: JourneyAsyncState) => {
    if (mountedRef.current) setInternalState(nextState);
  };

  const handlePress = () => {
    if (inFlightRef.current || unavailable || !onAction) return;

    inFlightRef.current = true;
    setInternalState({ status: "loading" });
    try {
      const result = onAction();
      if (result && typeof result.then === "function") {
        void Promise.resolve(result)
          .then(() => settleInternalState({ status: "idle" }))
          .catch(() => {
            settleInternalState({ status: "error", message: errorMessage ?? GENERIC_ACTION_ERROR });
          })
          .finally(() => {
            inFlightRef.current = false;
          });
        return;
      }

      settleInternalState({ status: "idle" });
    } catch {
      settleInternalState({ status: "error", message: errorMessage ?? GENERIC_ACTION_ERROR });
    }
    inFlightRef.current = false;
  };

  const visibleState = actionState && actionState.status !== "idle" ? actionState : internalState;
  const statusMessage = visibleState.status === "error"
    ? visibleState.message ?? errorMessage ?? GENERIC_ACTION_ERROR
    : visibleState.status === "success"
      ? visibleState.message
      : undefined;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel={accessibilityLabel ?? (loading ? loadingLabel : label)}
        accessibilityRole={role}
        accessibilityState={accessibilityState}
        disabled={unavailable}
        onPress={handlePress}
        style={[
          styles.action,
          selected && styles.selectedAction,
          unavailable && styles.disabledAction
        ]}
        testID={testID}
      >
        <Text
          style={[
            styles.label,
            selected && styles.selectedLabel,
            unavailable && styles.disabledLabel
          ]}
        >
          {loading ? loadingLabel : label}
        </Text>
        {selected ? <Text style={styles.selectedMarker}>已选中</Text> : null}
      </Pressable>
      {statusMessage ? (
        <JourneyStatusBanner
          message={statusMessage}
          tone={visibleState.status === "error" ? "error" : "success"}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: journeySpacing.sm },
  action: {
    alignItems: "center",
    backgroundColor: journeyColors.actionBackground,
    borderRadius: journeyRadii.md,
    justifyContent: "center",
    minHeight: journeySizes.minimumTouchTarget,
    minWidth: journeySizes.minimumTouchTarget,
    paddingHorizontal: journeySpacing.md,
    paddingVertical: journeySpacing.sm
  },
  selectedAction: { backgroundColor: journeyColors.selectedBackground },
  disabledAction: { backgroundColor: journeyColors.disabledBackground },
  label: {
    color: journeyColors.actionText,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
    textAlign: "center"
  },
  selectedLabel: { color: journeyColors.selectedText },
  disabledLabel: { color: journeyColors.disabledText },
  selectedMarker: {
    color: journeyColors.selectedText,
    fontSize: 13,
    lineHeight: 18,
    marginTop: journeySpacing.xs
  }
});

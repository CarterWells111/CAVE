import { useEffect, useRef, useState } from "react";
import type { AccessibilityRole, AccessibilityState } from "react-native";
import { Text, View } from "react-native";

import { theme } from "../../../../core/design/theme";
import { Button } from "../../../../core/ui/Button";
import type {
  JourneyAction as JourneyActionCallback,
  JourneyAsyncState
} from "../journey-ui-contracts";
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
  const visibleLabel = loading ? loadingLabel : label;

  return (
    <View style={{ gap: theme.space.sm }}>
      <Button
        accessibilityLabel={accessibilityLabel}
        disabled={disabled || !onAction}
        label={visibleLabel}
        loading={loading}
        onPress={handlePress}
        role={role}
        selected={selected}
        state={state}
        testID={testID}
      />
      {selected ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
        >
          <Text style={{ ...theme.typography.caption, color: theme.color.text }}>✓ 已选中</Text>
        </View>
      ) : null}
      {statusMessage ? (
        <JourneyStatusBanner
          message={statusMessage}
          tone={visibleState.status === "error" ? "error" : "success"}
        />
      ) : null}
    </View>
  );
}

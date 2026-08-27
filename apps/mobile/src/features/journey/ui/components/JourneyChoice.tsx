import type { JourneyAction as JourneyActionCallback } from "../journey-ui-contracts";
import { JourneyAction } from "./JourneyAction";

export type JourneyChoiceProps = {
  label: string;
  selected: boolean;
  onSelect?: JourneyActionCallback | undefined;
  mode?: "single" | "multiple" | undefined;
  disabled?: boolean | undefined;
  accessibilityLabel?: string | undefined;
  testID?: string | undefined;
};

export function JourneyChoice({
  label,
  selected,
  onSelect,
  mode = "multiple",
  disabled,
  accessibilityLabel,
  testID
}: JourneyChoiceProps) {
  return (
    <JourneyAction
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      label={label}
      loadingLabel="正在更新"
      onAction={onSelect}
      role={mode === "single" ? "radio" : "checkbox"}
      selected={selected}
      testID={testID}
    />
  );
}

import { act, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { MotionPreferencesProvider } from "../../../../core/design/motion-preferences";
import { JourneyChoice } from "./JourneyChoice";

test("an already mounted JourneyChoice follows reduceMotionChanged", async () => {
  let listener: ((enabled: boolean) => void) | undefined;
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation(((_event: string, next: (enabled: boolean) => void) => {
    listener = next;
    return { remove: jest.fn() };
  }) as never);

  render(<MotionPreferencesProvider><JourneyChoice accessibilityLabel="motion choice" label="Motion" onSelect={jest.fn()} selected={false} testID="motion-choice" /></MotionPreferencesProvider>);
  await act(async () => undefined);
  const choice = screen.getByTestId("motion-choice");
  expect(choice.props.style.transform).toEqual([{ scale: 1 }]);

  act(() => listener?.(true));
  expect(choice.props.style.transform).toBeUndefined();
});

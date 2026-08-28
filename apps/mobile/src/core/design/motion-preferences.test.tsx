import { act, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Text } from "react-native";

import { MotionPreferencesProvider, useReducedMotion } from "./motion-preferences";

function Consumer() {
  const reducedMotion = useReducedMotion();
  return <Text>{reducedMotion ? "reduced" : "full"}</Text>;
}

test("uses a fail-safe static default, follows the iOS preference, and cleans up the listener", async () => {
  let listener: ((enabled: boolean) => void) | undefined;
  const remove = jest.fn();
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation(((_event: string, nextListener: (enabled: boolean) => void) => {
    listener = nextListener;
    return { remove };
  }) as never);

  const view = render(<MotionPreferencesProvider><Consumer /></MotionPreferencesProvider>);
  expect(screen.getByText("full")).toBeTruthy();

  await act(async () => undefined);
  expect(screen.getByText("reduced")).toBeTruthy();

  act(() => listener?.(false));
  expect(screen.getByText("full")).toBeTruthy();

  view.unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});

test("falls back to full motion when the platform preference cannot be read", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockRejectedValue(new Error("unavailable"));
  jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({ remove: jest.fn() } as never);

  render(<MotionPreferencesProvider><Consumer /></MotionPreferencesProvider>);
  await act(async () => undefined);
  expect(screen.getByText("full")).toBeTruthy();
});

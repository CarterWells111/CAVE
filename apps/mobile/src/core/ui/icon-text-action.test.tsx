import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { IconTextAction } from "./icon-text-action";

test("renders one accessible icon-and-text action with a 44-point target", () => {
  const onPress = jest.fn();
  render(<IconTextAction icon="settings-outline" label="设置" onPress={onPress} />);

  const action = screen.getByRole("button", { name: "设置" });
  expect(screen.getByText("设置")).toBeTruthy();
  expect(StyleSheet.flatten(action.props.style)).toEqual(expect.objectContaining({
    minHeight: 44,
    minWidth: 44,
  }));
  fireEvent.press(action);
  expect(onPress).toHaveBeenCalledTimes(1);
});

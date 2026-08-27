import { fireEvent, render, screen } from "@testing-library/react-native";

import { theme } from "../design/theme";
import { Button } from "./Button";

function relativeLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/gu)!
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    );
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastRatio(first: string, second: string) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

test("renders a labelled button with a minimum 44 point target", () => {
  render(<Button label="继续" onPress={jest.fn()} />);

  const button = screen.getByRole("button", { name: "继续" });
  expect(screen.getByText("继续")).toBeTruthy();
  expect(button).toHaveProp("accessibilityState", { disabled: false, busy: false });
  expect(button).toHaveStyle({ minHeight: 44, minWidth: 44 });
});

test("shows color and non-color pressed signals", () => {
  render(<Button label="继续" onPress={jest.fn()} />);
  const button = screen.getByRole("button", { name: "继续" });
  const defaultBackground = button.props.style.backgroundColor;
  const defaultOpacity = button.props.style.opacity;

  fireEvent(button, "responderGrant", { nativeEvent: {}, persist: jest.fn() });

  expect(button.props.style.backgroundColor).not.toBe(defaultBackground);
  expect(button.props.style.opacity).not.toBe(defaultOpacity);
});

test("shows and clears an explicit focus treatment", () => {
  render(<Button label="继续" onPress={jest.fn()} />);
  const button = screen.getByRole("button", { name: "继续" });
  const normalBorderWidth = button.props.style.borderWidth;

  fireEvent(button, "focus");
  expect(button.props.style.borderWidth).toBe(normalBorderWidth);
  expect(button.props.style.outlineColor).toBe(theme.color.focus);
  expect(button.props.style.outlineWidth).toBe(theme.border.focusWidth);
  expect(button.props.style.outlineOffset).toBeGreaterThan(0);
  expect(contrastRatio(button.props.style.outlineColor, theme.color.background)).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(button.props.style.outlineColor, theme.color.surface)).toBeGreaterThanOrEqual(3);

  fireEvent(button, "blur");
  expect(button.props.style.outlineWidth).toBe(0);
});

test("keeps custom accessibility semantics on the focused interaction node", () => {
  render(
    <Button
      accessibilityLabel="选择继续"
      label="继续"
      onPress={jest.fn()}
      role="radio"
      selected
      state={{ expanded: true }}
      testID="semantic-button"
    />
  );

  const button = screen.getByRole("radio", { name: "选择继续" });
  expect(button).toHaveProp("testID", "semantic-button");
  expect(button).toHaveProp(
    "accessibilityState",
    expect.objectContaining({
      busy: false,
      checked: true,
      disabled: false,
      expanded: true,
      selected: true
    })
  );

  fireEvent(button, "focus");
  expect(button.props.style.outlineColor).toBe(theme.color.focus);
  expect(button.props.style.outlineWidth).toBe(theme.border.focusWidth);
  expect(button.props.style.outlineOffset).toBeGreaterThan(0);
});

test("does not activate while disabled", () => {
  const onPress = jest.fn();
  render(<Button disabled label="继续" onPress={onPress} />);

  const button = screen.getByRole("button", { name: "继续" });
  fireEvent.press(button);

  expect(onPress).not.toHaveBeenCalled();
  expect(button).toHaveProp("accessibilityState", { disabled: true, busy: false });
  expect(button.props.style.opacity).toBeLessThan(1);
});

test("keeps its visible label and blocks duplicate activation while loading", () => {
  const onPress = jest.fn();
  render(<Button label="保存" loading onPress={onPress} />);

  const button = screen.getByRole("button", { name: "保存" });
  fireEvent.press(button);
  fireEvent.press(button);

  expect(screen.getByText("保存")).toBeTruthy();
  expect(screen.getByText("加载中")).toBeTruthy();
  expect(button).toHaveProp("accessibilityState", { disabled: true, busy: true });
  expect(onPress).not.toHaveBeenCalled();
});

test("keeps loading label and status readable without dimming the whole control", () => {
  render(<Button label="保存" loading onPress={jest.fn()} />);

  const button = screen.getByRole("button", { name: "保存" });
  const label = screen.getByText("保存");
  const status = screen.getByText("加载中");

  expect(button.props.style.opacity).toBe(1);
  expect(contrastRatio(label.props.style.color, button.props.style.backgroundColor)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(status.props.style.color, button.props.style.backgroundColor)).toBeGreaterThanOrEqual(4.5);
});

test("wraps a long label inside a narrow large-text layout without truncation", () => {
  const label = "保存当前沟通卡并继续下一步";
  render(<Button label={label} onPress={jest.fn()} />);

  const button = screen.getByRole("button", { name: label });
  const text = screen.getByText(label);

  expect(button).toHaveStyle({
    flexShrink: 1,
    flexWrap: "wrap",
    maxWidth: "100%",
    minHeight: 44,
    minWidth: 44
  });
  expect(text).toHaveStyle({
    flexShrink: 1,
    flexWrap: "wrap",
    maxWidth: "100%",
    textAlign: "center"
  });
  expect(text.props.numberOfLines).toBeUndefined();
});

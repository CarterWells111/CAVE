import { fireEvent, render, screen } from "@testing-library/react-native";

import { darkTheme as theme } from "../design/theme";
import { ChoiceChip } from "./ChoiceChip";

test("exposes checkbox semantics and a visible checked marker", () => {
  render(
    <ChoiceChip
      label="带上安全套"
      onPress={jest.fn()}
      selected
      semantics="checkbox"
    />
  );

  const chip = screen.getByRole("checkbox", { name: "带上安全套" });
  expect(chip).toHaveProp("accessibilityState", { checked: true, disabled: false });
  expect(screen.getByText("带上安全套")).toBeTruthy();
  expect(screen.getByText("✓")).toBeTruthy();
  expect(chip).toHaveStyle({ minHeight: 56, minWidth: 44, width: "100%" });
  expect(chip).toHaveStyle({ borderColor: theme.color.brandSoft, borderWidth: 2 });
});

test("exposes radio semantics and visible selected and unselected markers", () => {
  const { rerender } = render(
    <ChoiceChip
      label="当时再决定"
      onPress={jest.fn()}
      selected={false}
      semantics="radio"
    />
  );

  expect(screen.getByRole("radio", { name: "当时再决定" })).toHaveProp("accessibilityState", {
    checked: false,
    selected: false,
    disabled: false
  });
  expect(screen.getByText("○")).toBeTruthy();

  rerender(
    <ChoiceChip
      label="当时再决定"
      onPress={jest.fn()}
      selected
      semantics="radio"
    />
  );

  expect(screen.getByRole("radio", { name: "当时再决定" })).toHaveProp("accessibilityState", {
    checked: true,
    selected: true,
    disabled: false
  });
  expect(screen.getByText("●")).toBeTruthy();
});

test("does not activate while disabled", () => {
  const onPress = jest.fn();
  render(
    <ChoiceChip
      disabled
      label="暂不选择"
      onPress={onPress}
      selected={false}
      semantics="checkbox"
    />
  );

  fireEvent.press(screen.getByRole("checkbox", { name: "暂不选择" }));

  expect(onPress).not.toHaveBeenCalled();
  expect(screen.getByText("不可用")).toBeTruthy();
});

test("shows color and non-color pressed signals", () => {
  render(
    <ChoiceChip
      label="当时再决定"
      onPress={jest.fn()}
      selected={false}
      semantics="radio"
    />
  );
  const chip = screen.getByRole("radio", { name: "当时再决定" });
  const defaultBackground = chip.props.style.backgroundColor;
  const defaultOpacity = chip.props.style.opacity;

  fireEvent(chip, "responderGrant", { nativeEvent: {}, persist: jest.fn() });

  expect(chip.props.style.backgroundColor).not.toBe(defaultBackground);
  expect(chip.props.style.opacity).not.toBe(defaultOpacity);
});

test("shows and clears an explicit focus treatment", () => {
  render(
    <ChoiceChip
      label="当时再决定"
      onPress={jest.fn()}
      selected={false}
      semantics="radio"
    />
  );
  const chip = screen.getByRole("radio", { name: "当时再决定" });
  const normalBorderWidth = chip.props.style.borderWidth;

  fireEvent(chip, "focus");
  expect(chip.props.style.borderWidth).toBe(normalBorderWidth);
  expect(chip.props.style.outlineColor).toBe(theme.color.focus);
  expect(chip.props.style.outlineWidth).toBe(theme.border.focusWidth);
  expect(chip.props.style.outlineOffset).toBeGreaterThan(0);

  fireEvent(chip, "blur");
  expect(chip.props.style.outlineWidth).toBe(0);
});

test("wraps a long choice label within the available narrow-screen width", () => {
  const label = "我想先停下来确认彼此都感到安全和舒服";
  render(
    <ChoiceChip
      label={label}
      onPress={jest.fn()}
      selected={false}
      semantics="checkbox"
    />
  );

  const chip = screen.getByRole("checkbox", { name: label });
  const text = screen.getByText(label);

  expect(chip).toHaveStyle({ maxWidth: "100%", minHeight: 56, minWidth: 44, width: "100%" });
  expect(text).toHaveStyle({
    flexShrink: 1,
    flexWrap: "wrap",
    maxWidth: "100%"
  });
  expect(text.props.numberOfLines).toBeUndefined();
});

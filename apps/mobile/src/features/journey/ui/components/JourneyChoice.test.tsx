import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { ChoiceChip } from "../../../../core/ui/ChoiceChip";
import { darkTheme as theme } from "../../../../core/design/theme";
import { JourneyChoice } from "./JourneyChoice";

function deferred<T>() {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    reject = rejectPromise;
    resolve = resolvePromise;
  });
  return { promise, reject, resolve };
}

test.each([
  ["multiple", "checkbox", true, "✓"],
  ["single", "radio", false, "○"]
] as const)(
  "maps %s choices to a core %s chip with a visible marker",
  (mode, role, selected, marker) => {
    const { UNSAFE_getByType } = render(
      <JourneyChoice
        label="当时再决定"
        mode={mode}
        onSelect={jest.fn()}
        selected={selected}
      />
    );

    expect(UNSAFE_getByType(ChoiceChip).props).toEqual(
      expect.objectContaining({ semantics: role, selected })
    );
    const choice = screen.getByRole(role, { name: "当时再决定" });
    expect(choice.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: selected, disabled: false })
    );
    expect(choice).toHaveStyle({ minWidth: theme.size.minimumTouchTarget });
    expect(StyleSheet.flatten(choice.props.style).minHeight).toBeGreaterThanOrEqual(
      theme.size.minimumTouchTarget
    );
    expect(screen.getByText(marker)).toBeTruthy();
  }
);

test("preserves a custom accessibility label and disables a missing action", () => {
  render(
    <JourneyChoice
      accessibilityLabel="自定义选项名称"
      label="屏幕上的选项"
      selected={false}
      testID="custom-choice"
    />
  );

  expect(screen.getByTestId("custom-choice")).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ checked: false, disabled: true })
  );
  expect(screen.getByLabelText("自定义选项名称")).toBeTruthy();
  expect(screen.getByText("屏幕上的选项", { includeHiddenElements: true })).toBeTruthy();
});

test("exposes exactly one accessible choice when a custom label wraps the core chip", () => {
  render(
    <JourneyChoice
      accessibilityLabel="亲吻：到时决定"
      label="到时决定"
      mode="single"
      onSelect={jest.fn()}
      selected={false}
    />
  );

  expect(screen.getAllByRole("radio")).toHaveLength(1);
  expect(screen.getByRole("radio", { name: "亲吻：到时决定" })).toBeTruthy();
  expect(screen.queryByRole("radio", { name: "到时决定" })).toBeNull();
});

test("keeps one accessible choice with busy state while an update is pending", async () => {
  const pending = deferred<void>();
  render(
    <JourneyChoice label="当时再决定" onSelect={() => pending.promise} selected={false} />
  );

  fireEvent.press(screen.getByRole("checkbox", { name: "当时再决定" }));

  expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  expect(screen.getByRole("checkbox", { name: "当时再决定" }).props.accessibilityState)
    .toEqual(expect.objectContaining({ busy: true, checked: false, disabled: true }));

  await act(async () => pending.resolve());
});

test("gives the custom-label adapter a non-color focus indicator", () => {
  render(
    <JourneyChoice
      accessibilityLabel="亲吻：期待"
      label="期待"
      mode="single"
      onSelect={jest.fn()}
      selected
      testID="focused-choice"
    />
  );
  const choice = screen.getByTestId("focused-choice");

  fireEvent(choice, "focus");

  expect(choice).toHaveStyle({
    outlineColor: theme.color.focus,
    outlineWidth: theme.border.focusWidth
  });
});

test("keeps the core chip's non-color pressed treatment and no journey-local visual tokens", () => {
  render(
    <JourneyChoice label="选项" onSelect={jest.fn()} selected={false} />
  );
  const choice = screen.getByRole("checkbox", { name: "选项" });
  const defaultOpacity = choice.props.style.opacity;
  const source = readFileSync(join(__dirname, "JourneyChoice.tsx"), "utf8");

  fireEvent(choice, "responderGrant", { nativeEvent: {}, persist: jest.fn() });

  expect(choice.props.style.opacity).not.toBe(defaultOpacity);
  expect(source).not.toContain('from "./JourneyAction"');
  expect(source).not.toContain("journey-ui-tokens");
});

test("keeps immediate duplicate-submit and safe rejection behavior", async () => {
  const pending = deferred<void>();
  const onSelect = jest.fn(() => pending.promise);
  const { rerender } = render(
    <JourneyChoice label="选项" onSelect={onSelect} selected={false} />
  );

  fireEvent.press(screen.getByRole("checkbox", { name: "选项" }));
  fireEvent.press(screen.getByRole("checkbox", { name: "选项" }));

  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("checkbox", { name: "选项" }).props.accessibilityState).toEqual(
    expect.objectContaining({ busy: true, disabled: true })
  );
  await act(async () => pending.resolve());

  const rejected = deferred<void>();
  rerender(
    <JourneyChoice label="选项" onSelect={() => rejected.promise} selected={false} />
  );
  fireEvent.press(screen.getByRole("checkbox", { name: "选项" }));
  await act(async () => rejected.reject(new Error("private raw failure")));

  expect(screen.getByText("操作失败，请重试。")).toBeTruthy();
  expect(screen.queryByText("private raw failure")).toBeNull();
});

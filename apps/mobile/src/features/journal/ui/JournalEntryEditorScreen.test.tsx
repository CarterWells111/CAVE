import { fireEvent, render, screen } from "@testing-library/react-native";

import { ThemeProvider } from "../../../core/design/theme-provider";
import { JournalEntryEditorScreen } from "./JournalEntryEditorScreen";

jest.mock("@react-native-community/datetimepicker", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return function MockDateTimePicker(props: Record<string, unknown>) {
    return React.createElement(View, { ...props, testID: "native-date-picker" });
  };
});

test("blocks repeated saves and back navigation while saving an entry", async () => {
  const onBack = jest.fn();
  const addEntry = jest.fn(() => new Promise(() => undefined));
  render(<JournalEntryEditorScreen onBack={onBack} recordId="synthetic" onSaved={jest.fn()} service={{ addEntry } as never} />);
  fireEvent.press(await screen.findByRole("button", { name: "保存这个后来" }));
  expect(screen.getByRole("button", { name: "返回手记列表" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "正在保存…" })).toBeDisabled();
  fireEvent.press(screen.getByRole("button", { name: "返回手记列表" }));
  fireEvent.press(screen.getByRole("button", { name: "正在保存…" }));
  expect(addEntry).toHaveBeenCalledTimes(1);
  expect(onBack).not.toHaveBeenCalled();
});

test("saves the calendar day selected for a later entry", async () => {
  const addEntry = jest.fn(async () => undefined);
  render(
    <ThemeProvider repository={{ load: async () => "dark", save: async () => undefined }}>
      <JournalEntryEditorScreen
        onSaved={jest.fn()}
        recordId="record-1"
        service={{ addEntry } as never}
      />
    </ThemeProvider>,
  );

  fireEvent.press(await screen.findByRole("button", { name: /变化日期/u }));
  fireEvent(screen.getByTestId("native-date-picker"), "onChange", { type: "set" }, new Date(2027, 0, 5));
  fireEvent.changeText(screen.getByLabelText("后续补充内容"), "后来有了新的理解");
  fireEvent.press(screen.getByRole("button", { name: "保存这个后来" }));
  expect(addEntry).toHaveBeenCalledWith("record-1", expect.objectContaining({ occurredAt: "2027-01-05" }));
});

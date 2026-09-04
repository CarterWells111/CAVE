import { fireEvent, render, screen } from "@testing-library/react-native";

import { darkTheme } from "../../../core/design/theme";
import { ThemeProvider } from "../../../core/design/theme-provider";
import { JournalDateField } from "./JournalDateField";

jest.mock("@react-native-community/datetimepicker", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return function MockDateTimePicker(props: Record<string, unknown>) {
    return React.createElement(View, { ...props, testID: "native-date-picker" });
  };
});

test("opens a native day picker and emits a future calendar date", async () => {
  const onChange = jest.fn();
  render(
    <ThemeProvider repository={{ load: async () => "dark", save: async () => undefined }}>
      <JournalDateField label="事件日期" onChange={onChange} value="2026-08-29" />
    </ThemeProvider>,
  );

  fireEvent.press(await screen.findByRole("button", { name: /事件日期/u }));
  const picker = screen.getByTestId("native-date-picker");
  expect(picker).toHaveProp("mode", "date");
  expect(picker).not.toHaveProp("maximumDate");
  fireEvent(picker, "onChange", { type: "set" }, new Date(2027, 0, 5));
  expect(onChange).toHaveBeenCalledWith("2027-01-05");
});

test("uses the active theme for the date control", async () => {
  render(
    <ThemeProvider repository={{ load: async () => "dark", save: async () => undefined }}>
      <JournalDateField label="变化日期" onChange={jest.fn()} value="2026-08-29" />
    </ThemeProvider>,
  );
  expect(await screen.findByRole("button", { name: /变化日期/u })).toHaveStyle({
    backgroundColor: darkTheme.color.surface,
    borderColor: darkTheme.color.border,
  });
});

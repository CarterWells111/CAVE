import { fireEvent, render, screen } from "@testing-library/react-native";

import { darkTheme } from "../../../core/design/theme";
import { ThemeProvider } from "../../../core/design/theme-provider";
import { JournalEditorScreen } from "./JournalEditorScreen";

jest.mock("@react-native-community/datetimepicker", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return function MockDateTimePicker(props: Record<string, unknown>) {
    return React.createElement(View, { ...props, testID: "native-date-picker" });
  };
}, { virtual: true });

test("uses a themed surface and a calendar control instead of an ISO text field", async () => {
  render(
    <ThemeProvider repository={{ load: async () => "dark", save: async () => undefined }}>
      <JournalEditorScreen
        initial={{ occurredAt: "2026-08-29T23:30:00.000Z" }}
        onSaved={jest.fn()}
        service={{ createRecord: jest.fn() } as never}
      />
    </ThemeProvider>,
  );

  expect(await screen.findByTestId("journal-editor-screen")).toHaveStyle({ backgroundColor: darkTheme.color.background });
  expect(screen.getByLabelText("关键事件标题")).toHaveStyle({
    backgroundColor: darkTheme.color.surface,
    color: darkTheme.color.text,
  });
  expect(screen.queryByLabelText("事件发生时间")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: /事件日期/u }));
  expect(screen.getByTestId("native-date-picker")).toBeTruthy();
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import type { JournalEntry, JournalEntryKind } from "../domain/journal-record";

import { ThemeProvider } from "../../../core/design/theme-provider";
import { JournalEntryEditorScreen } from "./JournalEntryEditorScreen";

jest.mock("@react-native-community/datetimepicker", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return function MockDateTimePicker(props: Record<string, unknown>) {
    return React.createElement(View, { ...props, testID: "native-date-picker" });
  };
});

test.each([
  ["event-change", "事情有了变化", "发生了什么变化？"],
  ["feeling-change", "感受有了变化", "现在的感受与当时有什么不同？"],
  ["action", "我采取了行动", "你做了什么？什么对你有帮助？"],
  ["insight", "我有了新理解", "这件事让你更了解自己的什么？"],
  ["correction", "更正或澄清", "请说明需要更正的内容，原记录不会被覆盖。"],
] as const)("selects and saves %s while keeping its prompt inline", async (kind: JournalEntryKind, label, prompt) => {
  const addEntry = jest.fn(async () => undefined);
  render(<JournalEntryEditorScreen recordId="r" service={{ addEntry } as never} onSaved={jest.fn()} />);
  expect(screen.queryByRole("radio")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "后来的类型，事情有了变化" }));
  fireEvent.press(screen.getByRole("radio", { name: label }));
  expect(screen.queryByRole("radio")).toBeNull();
  expect(screen.getByRole("button", { name: `后来的类型，${label}` })).toBeTruthy();
  expect(screen.getByText(prompt)).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText("后续补充内容"), "记下这个变化");
  fireEvent.press(screen.getByRole("button", { name: "保存这个后来" }));
  expect(addEntry).toHaveBeenCalledWith("r", expect.objectContaining({ kind, body: "记下这个变化" }));
});

test("preserves the initial kind on cancel and reports locked edits without overwriting", async () => {
  const updateEntry = jest.fn(async () => { throw new Error("journal-item-locked"); });
  const onSaved = jest.fn();
  render(<JournalEntryEditorScreen recordId="r" initial={{ id: "entry", kind: "insight", occurredAt: "2026-09-24", body: "原有理解" } as JournalEntry}
    service={{ updateEntry } as never} onSaved={onSaved} />);
  fireEvent.press(screen.getByRole("button", { name: "后来的类型，我有了新理解" }));
  fireEvent.press(screen.getByRole("button", { name: "关闭后来的类型" }));
  fireEvent.press(screen.getByRole("button", { name: "保存这个后来" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/修改时间已结束/u);
  expect(updateEntry).toHaveBeenCalledWith("entry", { kind: "insight", occurredAt: "2026-09-24", body: "原有理解" });
  expect(onSaved).not.toHaveBeenCalled();
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

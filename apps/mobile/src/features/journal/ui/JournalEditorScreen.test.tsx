import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { darkTheme } from "../../../core/design/theme";
import { ThemeProvider } from "../../../core/design/theme-provider";
import { JournalEditorScreen } from "./JournalEditorScreen";

test("saves edits made after draft cleanup fails without creating a duplicate", async () => {
  const clearDraft = jest.fn().mockRejectedValueOnce(new Error("cleanup failed")).mockResolvedValue(undefined);
  const createRecord = jest.fn(async () => ({ id: "saved" }));
  const updateRecord = jest.fn(async () => ({ id: "saved" }));
  const onSaved = jest.fn();
  render(<JournalEditorScreen service={{ loadDraft: async () => null, saveDraft: async () => undefined, clearDraft, createRecord, updateRecord } as never} onSaved={onSaved} />);
  await waitFor(() => expect(screen.getByLabelText("事件正文")).toHaveProp("editable", true));
  fireEvent.changeText(screen.getByLabelText("事件正文"), "第一次的文字");
  fireEvent.press(screen.getByRole("button", { name: "保存到本机" }));
  await screen.findByRole("alert");
  expect(onSaved).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText("事件正文"), "失败后补充的新文字");
  fireEvent.press(screen.getByRole("button", { name: "保存到本机" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith("saved"));
  expect(createRecord).toHaveBeenCalledTimes(1);
  expect(updateRecord).toHaveBeenCalledWith("saved", expect.objectContaining({ body: "失败后补充的新文字" }));
  expect(clearDraft).toHaveBeenCalledTimes(2);
});

jest.mock("@react-native-community/datetimepicker", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return function MockDateTimePicker(props: Record<string, unknown>) {
    return React.createElement(View, { ...props, testID: "native-date-picker" });
  };
});

test("offers a back action and blocks it while saving", async () => {
  const onBack = jest.fn();
  render(<JournalEditorScreen onBack={onBack} onSaved={jest.fn()} service={{ loadDraft: async () => null, saveDraft: async () => undefined, clearDraft: async () => undefined, createRecord: () => new Promise(() => undefined) } as never} />);
  fireEvent.press(await screen.findByRole("button", { name: "返回手记列表" }));
  expect(onBack).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole("button", { name: "保存到本机" }));
  expect(screen.getByRole("button", { name: "返回手记列表" })).toBeDisabled();
  fireEvent.press(screen.getByRole("button", { name: "返回手记列表" }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test("uses a themed surface and a calendar control instead of an ISO text field", async () => {
  render(
    <ThemeProvider repository={{ load: async () => "dark", save: async () => undefined }}>
      <JournalEditorScreen
        initial={{ occurredAt: "2026-08-29T23:30:00.000Z" }}
        onSaved={jest.fn()}
        service={{ loadDraft: async () => null, saveDraft: async () => undefined, clearDraft: async () => undefined, createRecord: jest.fn() } as never}
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

 test("restores a sentence draft and clears it only after saving", async () => {
  const draft = { title: "", occurredAt: "2026-09-07", highlight: { kind: "feeling", text: "" }, body: "只想安静一会儿", topics: [] };
  const clearDraft = jest.fn(async () => undefined);
  const createRecord = jest.fn(async () => ({ id: "saved" }));
  const onSaved = jest.fn();
  render(<JournalEditorScreen service={{ loadDraft: async () => draft, saveDraft: async () => undefined, clearDraft, createRecord } as never} onSaved={onSaved} />);
  await waitFor(() => expect(screen.getByLabelText("事件正文")).toHaveProp("value", draft.body));
  fireEvent.press(screen.getByRole("button", { name: "试试引导写作（可跳过）" }));
  expect(screen.getByText("今天有什么想记下的？")).toBeTruthy();
  expect(screen.queryByText("当时你注意到了什么感受？")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "下一题 / 跳过这题" }));
  expect(screen.getByText("当时你注意到了什么感受？")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "保存到本机" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith("saved"));
  expect(createRecord).toHaveBeenCalledWith(expect.objectContaining({ title: "", body: draft.body }));
  expect(clearDraft).toHaveBeenCalledWith("new:freeform");
 });

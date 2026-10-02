import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { darkTheme } from "../../../core/design/theme";
import { ThemeProvider } from "../../../core/design/theme-provider";
import { JournalEditorScreen } from "./JournalEditorScreen";

test("prefills a room report in the main text field and keeps it as a separate local draft", async () => {
  const saveDraft = jest.fn(async () => undefined);
  const createRecord = jest.fn();
  const service = {
    loadDraft: async () => null, saveDraft, clearDraft: async () => undefined,
    createRecord, listRecords: async () => [],
  } as never;
  render(<JournalEditorScreen initial={{ title: "此次沟通", body: "共同点与差异\n我们都想继续讨论。" }}
    draftKeyOverride="new:room-report:room-1:abc" service={service} onSaved={jest.fn()} />);
  await waitFor(() => expect(screen.getByLabelText("事件正文")).toHaveProp("editable", true));
  expect(screen.getByLabelText("事件正文")).toHaveProp("value", "共同点与差异\n我们都想继续讨论。");
  await waitFor(() => expect(saveDraft).toHaveBeenCalledWith("new:room-report:room-1:abc", expect.objectContaining({ body: "共同点与差异\n我们都想继续讨论。" })));
  expect(createRecord).not.toHaveBeenCalled();
});

test("saves edits made after draft cleanup fails without creating a duplicate", async () => {
  const clearDraft = jest.fn().mockRejectedValueOnce(new Error("cleanup failed")).mockResolvedValue(undefined);
  const createRecord = jest.fn(async () => ({ id: "saved" }));
  const updateRecord = jest.fn(async () => ({ id: "saved" }));
  const onSaved = jest.fn();
  render(<JournalEditorScreen service={{ loadDraft: async () => null, saveDraft: async () => undefined, clearDraft, createRecord, updateRecord, listRecords: async () => [] } as never} onSaved={onSaved} />);
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
  render(<JournalEditorScreen onBack={onBack} onSaved={jest.fn()} service={{ loadDraft: async () => null, saveDraft: async () => undefined, clearDraft: async () => undefined, createRecord: () => new Promise(() => undefined), listRecords: async () => [] } as never} />);
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
        service={{ loadDraft: async () => null, saveDraft: async () => undefined, clearDraft: async () => undefined, createRecord: jest.fn(), listRecords: async () => [] } as never}
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
  render(<JournalEditorScreen service={{ loadDraft: async () => draft, saveDraft: async () => undefined, clearDraft, createRecord, listRecords: async () => [] } as never} onSaved={onSaved} />);
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

test("adds a custom topic to the saved record", async () => {
  const createRecord = jest.fn(async () => ({ id: "saved" }));
  const onSaved = jest.fn();
  render(<JournalEditorScreen service={{
    loadDraft: async () => null, saveDraft: async () => undefined,
    clearDraft: async () => undefined, createRecord, listRecords: async () => [],
  } as never} onSaved={onSaved} />);
  await waitFor(() => expect(screen.getByLabelText("事件正文")).toHaveProp("editable", true));
  const buttons = screen.getAllByRole("button").map((button) => button.props.accessibilityLabel);
  for (const preset of ["亲密关系", "自我边界", "健康性生活"]) {
    expect(buttons.indexOf("自定义专题")).toBeLessThan(buttons.indexOf(preset));
  }
  expect(screen.getByRole("button", { name: "自定义专题" })).not.toHaveStyle({ backgroundColor: darkTheme.color.primary });
  fireEvent.changeText(screen.getByLabelText("事件正文"), "一起散步");
  fireEvent.press(screen.getByRole("button", { name: "自定义专题" }));
  fireEvent.changeText(screen.getByLabelText("自定义专题名称"), "  友情  ");
  fireEvent.press(screen.getByRole("button", { name: "添加专题" }));
  expect(screen.getByRole("button", { name: "✓ 友情" })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "保存到本机" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith("saved"));
  expect(createRecord).toHaveBeenCalledWith(expect.objectContaining({ topics: ["custom:友情"] }));
});

test("keeps writing guidance in help while leaving the active prompt and draft status inline", async () => {
  render(<JournalEditorScreen service={{ loadDraft: async () => null, saveDraft: async () => undefined, listRecords: async () => [] } as never} onSaved={jest.fn()} />);
  await screen.findByText("草稿已保存在本机");
  expect(screen.queryByText(/一句话也可以，不需要先想好标题/u)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "记下一件事，帮助" }));
  expect(screen.getByText(/一句话也可以，不需要先想好标题/u)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "关闭记下一件事 · 帮助" }));
  expect(screen.queryByText(/一句话也可以，不需要先想好标题/u)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "试试引导写作（可跳过）" }));
  expect(screen.getByText("今天有什么想记下的？")).toBeTruthy();
});

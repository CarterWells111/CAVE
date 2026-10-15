import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react-native";
import { JournalService } from "../journal/application/journal-service";
import { InMemoryJournalRepository } from "../journal/infrastructure/in-memory-journal-repository";
import type { AssistantJournalAccess } from "./assistant-journal";
import { useAssistantJournal } from "./use-assistant-journal";
import { AssistantJournalPicker } from "./AssistantJournalPicker";
import { AssistantJournalDraftPreview } from "./AssistantJournalDraftPreview";

let mockAccess: AssistantJournalAccess | null = null;
jest.mock("../journal/runtime/JournalAccessProvider", () => ({ useOptionalJournalAccess: () => mockAccess }));
jest.mock("../../core/design/theme-provider", () => ({ useTheme: () => jest.requireActual("../../core/design/theme").darkTheme }));
jest.mock("@react-native-community/datetimepicker", () => "DateTimePicker");

function setup() {
  let sequence = 0;
  const repository = new InMemoryJournalRepository();
  const service = new JournalService(repository, { now: () => "2026-10-14T10:00:00.000Z", createId: () => `synthetic-${++sequence}` }, "synthetic-account");
  mockAccess = { status: "ready", accountId: "synthetic-account", service };
  return { service, repository };
}
function Harness({ onSaved = jest.fn() }: { onSaved?: jest.Mock }) {
  const journal = useAssistantJournal();
  return <><AssistantJournalPicker journal={journal} /><AssistantJournalDraftPreview journal={journal} onSaved={onSaved} /></>;
}
beforeEach(() => { mockAccess = null; });

test("hook and picker render safely without a JournalAccessProvider", () => {
  const { result } = renderHook(() => useAssistantJournal());
  expect(result.current.available).toBe(false);
  render(<Harness />);
  expect(screen.getByText("登录并解锁手记后可选择附件。")).toBeTruthy();
  expect(screen.getByRole("button", { name: "新建手记草稿" })).toBeDisabled();
});

test("checkbox attachments and preview editing remain local until user confirms", async () => {
  const { service } = setup();
  const record = await service.createRecord({ title: "合成已有手记", occurredAt: "2026-10-13", body: "原文" });
  const create = jest.spyOn(service, "createRecord");
  const onSaved = jest.fn();
  render(<Harness onSaved={onSaved} />);
  const checkbox = await screen.findByRole("checkbox", { name: "选择手记：合成已有手记" });
  fireEvent.press(checkbox);
  expect(checkbox).toHaveProp("accessibilityState", { checked: true, disabled: false });
  fireEvent.press(screen.getByRole("button", { name: "新建手记草稿" }));
  fireEvent.changeText(screen.getByLabelText("手记标题"), "我的新标题");
  fireEvent.changeText(screen.getByLabelText("手记正文"), "我的新正文");
  expect(create).not.toHaveBeenCalled();
  expect((await service.loadRecord(record.id))!.record.body).toBe("原文");
  fireEvent.press(screen.getByRole("button", { name: "确认保存至我的手记" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(create).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("新手记预览")).toBeNull();
  expect(await service.listRecords()).toHaveLength(2);
});

test("cancel preview does not save", async () => {
  const { service } = setup();
  render(<Harness />);
  await waitFor(() => expect(screen.getByRole("button", { name: "新建手记草稿" })).not.toBeDisabled());
  fireEvent.press(screen.getByRole("button", { name: "新建手记草稿" }));
  fireEvent.changeText(screen.getByLabelText("手记正文"), "取消的内容");
  fireEvent.press(screen.getByRole("button", { name: "取消草稿" }));
  expect(screen.queryByText("新手记预览")).toBeNull();
  expect(await service.listRecords()).toHaveLength(0);
});

test("hook clears attachment and draft on account change and old controller refuses save", async () => {
  const { service } = setup();
  const record = await service.createRecord({ occurredAt: "2026-10-13", body: "账号一的合成文字" });
  const { result, rerender } = renderHook(() => useAssistantJournal());
  await act(async () => { await result.current.controller.refreshChoices(); });
  act(() => { result.current.controller.toggleSelection(record.id); result.current.controller.beginNew(); });
  const old = result.current.controller;
  mockAccess = { status: "ready", accountId: "synthetic-other", service: new JournalService(new InMemoryJournalRepository(), { now: () => "2026-10-14T10:00:00.000Z", createId: () => "other" }, "synthetic-other") };
  rerender({});
  expect(result.current.selectedIds).toEqual([]);
  expect(result.current.draft).toBeNull();
  expect(result.current.choices).toEqual([]);
  await expect(old.confirmSave()).rejects.toThrow("journal-session-changed");
});

test("unmount invalidates callbacks retaining the old draft controller", async () => {
  setup();
  const { result, unmount } = renderHook(() => useAssistantJournal());
  act(() => { result.current.controller.beginNew(); result.current.controller.editDraft({ title: "合成标题", body: "合成文字" }); });
  const controller = result.current.controller;
  unmount();
  await expect(controller.confirmSave()).rejects.toThrow("journal-session-changed");
});

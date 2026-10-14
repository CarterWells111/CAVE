import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createRef } from "react";
import type { AssistantResponse } from "@cave/contracts";

import { AssistantComposerInput, type AssistantComposerInputHandle } from "./AssistantComposerInput";
import { AssistantHistoryProvider, useAssistantHistorySession } from "./AssistantHistoryProvider";
import { InMemoryAssistantHistoryRepository } from "./history/in-memory-assistant-history-repository";

let mockSequence = 0;
let mockRepository: InMemoryAssistantHistoryRepository;
jest.mock("expo-crypto", () => ({ randomUUID: () => `synthetic-composer-${++mockSequence}` }));
jest.mock("../auth/runtime/AuthProvider", () => ({ useOptionalAuth: () => ({ accountId: "synthetic-composer-owner" }) }));
jest.mock("../journey/runtime/JourneyRuntimeProvider", () => ({ useAdultDeclaration: () => ({ status: "authorized" }), useOptionalJourneyRuntime: () => ({ assistantHistory: mockRepository }) }));
beforeEach(() => { mockSequence = 0; mockRepository = new InMemoryAssistantHistoryRepository(); });

test("continuous composition-like input remains native-owned despite delayed old draft echoes", () => {
  const ref = createRef<AssistantComposerInputHandle>();
  const change = jest.fn();
  const tree = (echo: string) => <AssistantComposerInput ref={ref} accessibilityLabel="合成输入" initialValue={echo} replacement={{ revision: "conversation-one", text: echo }} onChangeText={change} />;
  const view = render(tree(""));
  const native = screen.getByLabelText("合成输入");
  for (const [next, oldEcho] of [["n", ""], ["ni", "n"], ["你", "ni"], ["你好", "你"]]) {
    fireEvent.changeText(native, next);
    view.rerender(tree(oldEcho!));
    expect(screen.getByLabelText("合成输入")).toBe(native);
    expect(native.props.value).toBeUndefined();
    expect(native.props.selection).toBeUndefined();
    expect(native.props.defaultValue).toBe("");
    expect(ref.current?.getText()).toBe(next);
  }
  expect(change.mock.calls.map(([text]) => text)).toEqual(["n", "ni", "你", "你好"]);
});

test("native selection survives provider echoes without a controlled selection prop", () => {
  const ref = createRef<AssistantComposerInputHandle>();
  const selectionChange = jest.fn();
  const view = render(<AssistantComposerInput ref={ref} accessibilityLabel="合成输入" initialValue="中文正文" onChangeText={jest.fn()} onSelectionChange={selectionChange} />);
  const native = screen.getByLabelText("合成输入");
  fireEvent(native, "selectionChange", { nativeEvent: { selection: { start: 1, end: 3 } } });
  view.rerender(<AssistantComposerInput ref={ref} accessibilityLabel="合成输入" initialValue="迟到的旧正文" onChangeText={jest.fn()} onSelectionChange={selectionChange} />);
  expect(screen.getByLabelText("合成输入")).toBe(native);
  expect(ref.current?.getSelection()).toEqual({ start: 1, end: 3 });
  expect(native.props.selection).toBeUndefined();
  expect(selectionChange).toHaveBeenCalledTimes(1);
});

test("explicit history revisions replace native text and ignore events retained by the old input", () => {
  const ref = createRef<AssistantComposerInputHandle>();
  const change = jest.fn();
  const view = render(<AssistantComposerInput ref={ref} accessibilityLabel="合成输入" replacement={{ revision: 1, text: "旧对话" }} onChangeText={change} />);
  const old = screen.getByLabelText("合成输入");
  const lateChange = old.props.onChangeText as (text: string) => void;
  view.rerender(<AssistantComposerInput ref={ref} accessibilityLabel="合成输入" replacement={{ revision: 2, text: "历史对话的草稿" }} onChangeText={change} />);
  expect(screen.getByLabelText("合成输入")).not.toBe(old);
  expect(screen.getByLabelText("合成输入")).toHaveProp("defaultValue", "历史对话的草稿");
  act(() => lateChange("迟到的旧对话输入"));
  expect(ref.current?.getText()).toBe("历史对话的草稿");
  expect(change).not.toHaveBeenCalled();
  view.rerender(<AssistantComposerInput ref={ref} accessibilityLabel="合成输入" replacement={{ revision: 3, text: "" }} onChangeText={change} />);
  expect(ref.current?.getText()).toBe("");
});

test("suggestions replace text explicitly, synchronize history once and clear after sending without accepting old echoes", () => {
  const ref = createRef<AssistantComposerInputHandle>();
  const change = jest.fn();
  const view = render(<AssistantComposerInput ref={ref} accessibilityLabel="合成输入" initialValue="" onChangeText={change} />);
  act(() => ref.current?.replaceText("建议填入的中文", { focus: true, selection: { start: 2, end: 4 } }));
  expect(ref.current?.getText()).toBe("建议填入的中文");
  expect(ref.current?.getSelection()).toEqual({ start: 2, end: 4 });
  expect(change).toHaveBeenCalledWith("建议填入的中文");
  const native = screen.getByLabelText("合成输入");
  expect(native).toHaveProp("defaultValue", "建议填入的中文");
  view.rerender(<AssistantComposerInput ref={ref} accessibilityLabel="合成输入" initialValue="旧history回显" onChangeText={change} />);
  expect(screen.getByLabelText("合成输入")).toBe(native);
  expect(ref.current?.getText()).toBe("建议填入的中文");
  act(() => ref.current?.clear({ emitChange: false }));
  expect(ref.current?.getText()).toBe("");
  expect(change).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("合成输入")).toHaveProp("defaultValue", "");
});

test("disabled input rejects retained native events and preserves the draft for re-enabling", () => {
  const ref = createRef<AssistantComposerInputHandle>();
  const change = jest.fn();
  const view = render(<AssistantComposerInput ref={ref} accessibilityLabel="合成输入" initialValue="保留草稿" onChangeText={change} />);
  const lateChange = screen.getByLabelText("合成输入").props.onChangeText as (text: string) => void;
  view.rerender(<AssistantComposerInput ref={ref} accessibilityLabel="合成输入" initialValue="" editable={false} onChangeText={change} />);
  act(() => lateChange("发送期间迟到的输入"));
  expect(ref.current?.getText()).toBe("保留草稿");
  expect(change).not.toHaveBeenCalled();
  view.rerender(<AssistantComposerInput ref={ref} accessibilityLabel="合成输入" initialValue="" onChangeText={change} />);
  fireEvent.changeText(screen.getByLabelText("合成输入"), "保留草稿继续中文输入");
  expect(ref.current?.getText()).toBe("保留草稿继续中文输入");
});

test("all native edits reach the real history provider and restore after switching conversations", async () => {
  const ref = createRef<AssistantComposerInputHandle>();
  let history!: ReturnType<typeof useAssistantHistorySession>;
  function Coordinator() {
    history = useAssistantHistorySession();
    return <AssistantComposerInput ref={ref} accessibilityLabel="合成输入" initialValue={history.draft} replacement={{ revision: history.conversationRevision, text: history.draft }} onChangeText={history.setDraft} />;
  }
  render(<AssistantHistoryProvider><Coordinator /></AssistantHistoryProvider>);
  await act(async () => undefined);
  const response: AssistantResponse = { status: "ok", providerMode: "mock", message: "合成回复", observations: [], sources: [] };
  act(() => history.appendTurn("已保存的对话", response));
  const oldId = history.activeId!;
  for (const text of ["n", "ni", "你", "你好", "你好，今天想聊聊"]) fireEvent.changeText(screen.getByLabelText("合成输入"), text);
  expect(history.draft).toBe("你好，今天想聊聊");
  expect(ref.current?.getText()).toBe("你好，今天想聊聊");
  act(() => history.newConversation());
  expect(ref.current?.getText()).toBe("");
  await waitFor(async () => expect((await mockRepository.list("synthetic-composer-owner"))[0]?.draft).toBe("你好，今天想聊聊"));
  act(() => history.selectConversation(oldId));
  expect(ref.current?.getText()).toBe("你好，今天想聊聊");
  expect(screen.getByLabelText("合成输入").props.value).toBeUndefined();
});

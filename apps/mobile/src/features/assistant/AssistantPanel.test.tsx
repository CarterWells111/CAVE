import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AssistantPanel } from "./AssistantPanel";
import type { AssistantResponse } from "@cave/contracts";

const records = [{ id: "record-1", text: "今天的记录\n只发这一条" }];
const result: AssistantResponse = { status: "ok", providerMode: "mock", message: "模拟回答", summary: "提议的小结", observations: [{ text: "观察", sourceRecordIds: ["record-1"] }], sources: [] };
let mockAccountId: string | undefined = "account-one";
jest.mock("../auth/runtime/AuthProvider", () => ({ useOptionalAuth: () => ({ accountId: mockAccountId }) }));
beforeEach(() => { mockAccountId = "account-one"; delete process.env.EXPO_PUBLIC_ASSISTANT_MODE; });

test("requires content preview and explicit send, then explicit adoption", async () => {
  const request = jest.fn(async () => result); const onAdopt = jest.fn(); const onOpenRecord = jest.fn();
  render(<AssistantPanel records={records} request={request} onAdopt={onAdopt} onOpenRecord={onOpenRecord} />);
  expect(request).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "帮我整理" }));
  expect(screen.getByText(records[0]!.text)).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "同意本次发送并继续" }));
  expect(await screen.findByText("模拟结果 · 未调用真实模型")).toBeTruthy();
  expect(onAdopt).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "符合，放入编辑区" }));
  expect(onAdopt).toHaveBeenCalledWith("提议的小结");
  fireEvent.press(screen.getByRole("button", { name: "查看原记录：今天的记录" }));
  expect(onOpenRecord).toHaveBeenCalledWith("record-1");
});

test("editing content invalidates consent and ignores late results", async () => {
  let resolve!: (value: AssistantResponse) => void;
  const request = jest.fn(() => new Promise<AssistantResponse>(r => { resolve = r; }));
  const view = render(<AssistantPanel records={records} request={request} />);
  fireEvent.press(screen.getByRole("button", { name: "帮我整理" }));
  fireEvent.press(screen.getByRole("button", { name: "同意本次发送并继续" }));
  view.rerender(<AssistantPanel records={[{ id: "record-1", text: "改过的文字" }]} request={request} />);
  await act(async () => resolve(result));
  expect(screen.queryByText("提议的小结")).toBeNull();
  expect(screen.queryByRole("button", { name: "同意本次发送并继续" })).toBeNull();
});

test("account change removes private preview and results", async () => {
  const request = jest.fn(async () => result);
  const view = render(<AssistantPanel records={records} request={request} />);
  fireEvent.press(screen.getByRole("button", { name: "帮我整理" }));
  mockAccountId = "account-two";
  view.rerender(<AssistantPanel records={[]} request={request} />);
  expect(screen.queryByText(records[0]!.text)).toBeNull();
  expect(request).not.toHaveBeenCalled();
});

test("network failure and cancel never invoke adoption", async () => {
  const onAdopt = jest.fn();
  render(<AssistantPanel records={records} request={jest.fn(async () => { throw new Error("private error"); })} onAdopt={onAdopt} />);
  fireEvent.press(screen.getByRole("button", { name: "帮我整理" }));
  fireEvent.press(screen.getByRole("button", { name: "同意本次发送并继续" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText("private error")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "暂不使用" }));
  expect(onAdopt).not.toHaveBeenCalled();
});

test("journey requests contain question and journey id but no journals", async () => {
  const request = jest.fn(async () => ({ ...result, summary: undefined, observations: [] }));
  render(<AssistantPanel records={[]} modes={["journey"]} journeyId="first-overnight" request={request} />);
  fireEvent.changeText(screen.getByLabelText("想问的旅程问题"), "怎么暂停？");
  fireEvent.press(screen.getByRole("button", { name: "问问这一步" }));
  fireEvent.press(screen.getByRole("button", { name: "同意本次发送并继续" }));
  await screen.findByText("模拟回答");
  expect(request).toHaveBeenCalledWith({ mode: "journey", consent: true, records: [], question: "怎么暂停？", journeyId: "first-overnight" }, expect.anything());
});

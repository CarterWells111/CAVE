import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import * as Clipboard from "expo-clipboard";

import { createFakeRoomServer } from "../infrastructure/fake-room-api";
import { RoomApiError } from "../infrastructure/room-api-client";
import { RoomDetailPage, RoomJoinPage, RoomNewPage, RoomStartPage } from "./room-pages";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, canGoBack: () => false, back: jest.fn() }),
  useFocusEffect: (callback: () => void) => { const React = jest.requireActual<typeof import("react")>("react"); React.useEffect(callback, [callback]); },
}));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => undefined) }));

beforeEach(() => { jest.clearAllMocks(); });
afterEach(() => { jest.restoreAllMocks(); });

test("canceling scenario selection preserves the selection and creates nothing", async () => {
  const api = createFakeRoomServer().forAccount("alice");
  render(<RoomNewPage api={api} />);
  fireEvent.press(screen.getByRole("button", { name: "情景，第一次过夜" }));
  fireEvent.press(screen.getByRole("button", { name: "关闭情景" }));
  expect(screen.getByRole("button", { name: "情景，第一次过夜" })).toBeTruthy();
  expect(await api.list()).toHaveLength(0);
});

test("creating a room keeps the not-open-yet error inline", async () => {
  const api = createFakeRoomServer().forAccount("alice");
  render(<RoomStartPage scenarioId="pause" api={{ ...api, create: async () => { throw new RoomApiError("HTTP_404", 404); } }} />);
  expect(screen.getByText(/你的回答逐题上传并保存在云端/u)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "同意云端保存，创建房间" }));
  expect(await screen.findByText("双人房间内测尚未开启，请稍后再试。")).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
});

test("join token is prefilled but joins only after explicit cloud consent", async () => {
  const server = createFakeRoomServer();
  const alice = server.forAccount("alice");
  const bob = server.forAccount("bob");
  const room = await alice.create("pause");
  const token = await alice.issueInvite(room.id);
  const join = jest.fn(bob.join);
  render(<RoomJoinPage api={{ ...bob, join }} initialToken={token} />);
  expect(screen.getByLabelText("邀请令牌").props.value).toBe(token);
  expect(screen.getByText(/加入后，你的回答会逐题保存到云端/u)).toBeTruthy();
  expect(join).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText("邀请令牌"), "invalid");
  expect(screen.getByRole("button", { name: "同意云端保存，加入房间" })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText("邀请令牌"), token);
  fireEvent.press(screen.getByRole("button", { name: "同意云端保存，加入房间" }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: "/rooms/[roomId]", params: { roomId: room.id } }));
  expect(join).toHaveBeenCalledWith(token);
});

test("answer editing never auto saves and explicit per-question saving stays available", async () => {
  const api = createFakeRoomServer().forAccount("alice");
  const room = await api.create("pause");
  const saveAnswer = jest.fn(api.saveAnswer);
  render(<RoomDetailPage api={{ ...api, saveAnswer }} roomId={room.id} />);
  fireEvent.changeText(await screen.findByLabelText("期待的回答"), "  先问我  ");
  expect(saveAnswer).not.toHaveBeenCalled();
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "保存这题到云端" })); });
  await waitFor(() => expect(saveAnswer).toHaveBeenCalledWith(room.id, "expectation", "先问我"));
  expect((await api.get(room.id)).myCompleted).toBe(false);
  expect(screen.getByRole("button", { name: "完成我的回答" })).toBeDisabled();
});

test("waiting refresh reveals generation only after both participants separately consent", async () => {
  const server = createFakeRoomServer();
  const alice = server.forAccount("alice");
  const bob = server.forAccount("bob");
  const room = await alice.create("pause");
  await bob.join(await alice.issueInvite(room.id));
  await alice.complete(room.id, true);
  const generateReport = jest.fn(alice.generateReport);
  render(<RoomDetailPage api={{ ...alice, generateReport }} roomId={room.id} />);
  expect(await screen.findByText(/你的回答已完成/u)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "生成共同报告" })).toBeNull();
  await bob.complete(room.id, true);
  fireEvent.press(screen.getByRole("button", { name: "刷新状态" }));
  expect(await screen.findByRole("button", { name: "生成共同报告" })).toBeTruthy();
  expect(generateReport).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "生成共同报告" }));
  expect(await screen.findByText(/目前没有足够的双方信息/u)).toBeTruthy();
  expect(generateReport).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("期待的回答").props.editable).toBe(true);
});

test("supplementing insufficient answers keeps an explicit completion step", async () => {
  const server = createFakeRoomServer();
  const alice = server.forAccount("alice");
  const bob = server.forAccount("bob");
  const room = await alice.create("pause");
  await bob.join(await alice.issueInvite(room.id));
  await bob.complete(room.id, true);
  const complete = jest.fn(alice.complete);
  render(<RoomDetailPage api={{ ...alice, complete }} roomId={room.id} />);
  await screen.findByRole("checkbox");
  fireEvent.press(screen.getByRole("checkbox"));
  fireEvent.press(screen.getByRole("button", { name: "完成我的回答" }));
  fireEvent.press(await screen.findByRole("button", { name: "生成共同报告" }));
  await screen.findByText(/目前没有足够的双方信息/u);
  fireEvent.changeText(screen.getByLabelText("期待的回答"), "补充");
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "保存这题到云端" })); });
  expect(await screen.findByRole("button", { name: "完成我的回答" })).toBeTruthy();
  expect(complete).toHaveBeenCalledTimes(1);
  expect((await alice.get(room.id)).myCompleted).toBe(false);
  expect(screen.queryByRole("button", { name: "生成共同报告" })).toBeNull();
});

test("invite tools issue and copy a new link only when pressed", async () => {
  const api = createFakeRoomServer().forAccount("alice");
  const room = await api.create("pause");
  const issueInvite = jest.fn(api.issueInvite);
  render(<RoomDetailPage api={{ ...api, issueInvite }} roomId={room.id} />);
  expect(await screen.findByText(/每次复制都会签发新邀请/u)).toBeTruthy();
  expect(issueInvite).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "签发并复制加入链接" }));
  expect(await screen.findByText("加入链接已复制。请只发给想邀请的人。")).toBeTruthy();
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith(expect.stringContaining("https://neijiecave.com/join#invite="));
  expect(issueInvite).toHaveBeenCalledTimes(1);
});

test("ending still requires destructive confirmation and disables room tasks", async () => {
  const api = createFakeRoomServer().forAccount("alice");
  const room = await api.create("pause");
  const end = jest.fn(api.end);
  const alert = jest.spyOn(Alert, "alert");
  render(<RoomDetailPage api={{ ...api, end }} roomId={room.id} />);
  fireEvent.press(await screen.findByRole("button", { name: "终止房间" }));
  expect(end).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalledWith("终止房间？", "终止后双方都不能继续作答或生成报告。", expect.any(Array));
  const confirm = alert.mock.calls[0]![2]!.find((button) => button.style === "destructive")!;
  await act(async () => { confirm.onPress?.(); });
  expect(end).toHaveBeenCalledWith(room.id);
  expect(screen.getByText("房间已终止，不能继续作答或生成报告。")).toBeTruthy();
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(screen.queryByRole("button", { name: "签发并复制加入链接" })).toBeNull();
  expect(screen.queryByLabelText("期待的回答")).toBeNull();
});

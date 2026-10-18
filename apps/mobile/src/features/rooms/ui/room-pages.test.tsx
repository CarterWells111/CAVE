import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { ROOM_QUESTIONS, ROOM_SCENARIOS } from "../domain/room";
import { ROOM_ANSWER_GUIDES } from "../domain/room-answer-guides";
import { createFakeRoomServer } from "../infrastructure/fake-room-api";
import { RoomApiError } from "../infrastructure/room-api-client";
import { MyRoomsPage, RoomDetailPage, RoomListPage, RoomNewPage } from "./room-pages";

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, canGoBack: () => false, back: jest.fn() }),
  useFocusEffect: (callback: () => void) => { const React = jest.requireActual<typeof import("react")>("react"); React.useEffect(callback, [callback]); },
}));

beforeEach(() => { mockPush.mockClear(); mockReplace.mockClear(); });

test("room home uses one target per scenario and puts general guidance in help", () => {
  render(<RoomListPage />);
  expect(screen.queryByText(/从一个情景开始/u)).toBeNull();
  expect(screen.queryByRole("button", { name: "选择说出暂停" })).toBeNull();
  expect(screen.getByText("房间工具")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "加入房间" }));
  fireEvent.press(screen.getByRole("button", { name: "我的房间" }));
  fireEvent.press(screen.getByRole("button", { name: "说出暂停，练习在需要时停下来，并听见彼此的回应。" }));
  expect(mockPush.mock.calls).toEqual([
    ["/join"],
    ["/rooms/mine"],
    [{ pathname: "/rooms/choose", params: { scenario: "pause" } }],
  ]);
  fireEvent.press(screen.getByRole("button", { name: "房间，帮助" }));
  expect(screen.getByText(/从一个情景开始/u)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "关闭房间 · 帮助" }));
  expect(screen.queryByText(/从一个情景开始/u)).toBeNull();
});

test("room list explains when the remote beta route is not enabled", async () => {
  const api = createFakeRoomServer().forAccount("alice");
  render(<MyRoomsPage api={{ ...api, list: async () => { throw new RoomApiError("HTTP_404", 404); } }} />);
  expect(await screen.findByText("双人房间内测尚未开启。你可以先查看情景，选择单人模式体验。")).toBeTruthy();
  expect(screen.getByRole("button", { name: "新建房间" })).toBeTruthy();
});

test("my rooms lists existing rooms and opens the new room screen", async () => {
  const api = createFakeRoomServer().forAccount("alice");
  const room = await api.create("pause");
  render(<MyRoomsPage api={api} />);
  const roomButton = await screen.findByRole("button", { name: "说出暂停，待加入" });
  fireEvent.press(roomButton);
  fireEvent.press(screen.getByRole("button", { name: "新建房间" }));
  expect(mockPush.mock.calls).toEqual([
    [{ pathname: "/rooms/[roomId]", params: { roomId: room.id } }],
    ["/rooms/new"],
  ]);
});

test("new room creates the selected scenario and goes directly to questions", async () => {
  const api = createFakeRoomServer().forAccount("alice");
  render(<RoomNewPage api={api} />);
  expect(screen.queryByRole("button", { name: "一个人探索" })).toBeNull();
  expect(screen.getByText(/你的回答会逐题加密保存到云端/u)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "情景，第一次过夜" }));
  fireEvent.press(screen.getByRole("radio", { name: /说出暂停/u }));
  expect(await api.list()).toHaveLength(0);
  expect(mockReplace).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "同意云端保存，创建房间" }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: "/rooms/[roomId]", params: { roomId: "1" } }));
  expect((await api.get("1")).scenarioId).toBe("pause");
});

test("room permits skipped questions and waits for explicit report consent", async () => {
  const api = createFakeRoomServer().forAccount("alice");
  const room = await api.create("pause");
  render(<RoomDetailPage api={api} roomId={room.id} />);
  expect(await screen.findByText("说出暂停")).toBeTruthy();
  expect(screen.queryByText(/（可跳过）/u)).toBeNull();
  expect(screen.queryByRole("button", { name: "清空这题" })).toBeNull();
  expect(screen.getByRole("button", { name: "完成我的回答" })).toBeDisabled();
  fireEvent.press(screen.getByRole("checkbox"));
  fireEvent.press(screen.getByRole("button", { name: "完成我的回答" }));
  await waitFor(() => expect(screen.getByText(/你的回答已完成/u)).toBeTruthy());
  expect((await api.get(room.id)).myAnswers).toEqual({});
});

test("shared report shows three sections and offers explicit export, AI and journal actions", async () => {
  const server = createFakeRoomServer();
  const alice = server.forAccount("alice");
  const bob = server.forAccount("bob");
  const room = await alice.create("adjust");
  await bob.join(await alice.issueInvite(room.id));
  await alice.saveAnswer(room.id, "expectation", "我的节奏");
  await alice.saveAnswer(room.id, "concern", "担心太快");
  await bob.saveAnswer(room.id, "boundary", "先询问");
  await bob.saveAnswer(room.id, "expectation", "希望慢一点");
  await alice.complete(room.id, true);
  await bob.complete(room.id, true);
  await bob.generateReport(room.id);
  const onDiscuss = jest.fn();
  const onRecord = jest.fn();
  const onExport = jest.fn(async () => undefined);
  render(<RoomDetailPage api={bob} roomId={room.id} onDiscuss={onDiscuss} onRecord={onRecord} onExport={onExport} />);
  expect(await screen.findByText("共同点与差异")).toBeTruthy();
  expect(screen.getByText("A 是房间发起人，B 是受邀者。")).toBeTruthy();
  expect(screen.getByText("给你们的建议")).toBeTruthy();
  expect(screen.getByText("接下来的建议")).toBeTruthy();
  expect(screen.queryByText(/可以说：/u)).toBeNull();
  expect(screen.queryByRole("button", { name: "导出报告（图片）" })).toBeNull();
  expect(onDiscuss).not.toHaveBeenCalled();
  expect(onRecord).not.toHaveBeenCalled();
  expect(onExport).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "报告工具" }));
  expect(screen.getByText(/导出图片仅保存到本机相册/u)).toBeTruthy();
  expect(screen.getByText(/只有你点击保存才成为记录/u)).toBeTruthy();
  expect(screen.getByRole("button", { name: "导出报告（图片）" })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "和内界AI详细聊聊" }));
  expect(onDiscuss).toHaveBeenCalledWith(expect.stringContaining("仍不确定的地方"), "adjust");
  fireEvent.press(screen.getByRole("button", { name: "报告工具" }));
  fireEvent.press(screen.getByRole("button", { name: "记录此次沟通" }));
  expect(onRecord).toHaveBeenCalledWith(expect.stringContaining("共同点与差异"), room.id);
  expect(screen.queryByText("我的节奏")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "查看我的回答" }));
  expect(screen.getByLabelText("期待的回答").props.value).toBe("希望慢一点");
  expect(screen.getByLabelText("期待的回答").props.editable).toBe(false);
  expect(screen.queryByRole("button", { name: "保存这题到云端" })).toBeNull();
});

test.each(ROOM_SCENARIOS)("$title offers five independent cycling examples per question without changing or uploading answers", async ({ id: scenarioId }) => {
  const api = createFakeRoomServer().forAccount("synthetic-room-guide-owner");
  const room = await api.create(scenarioId);
  const saveAnswer = jest.fn(api.saveAnswer);
  render(<RoomDetailPage api={{ ...api, saveAnswer }} roomId={room.id} />);
  await screen.findByLabelText("期待的回答");
  expect(screen.queryByText(/（可跳过）/u)).toBeNull();
  expect(screen.queryByRole("button", { name: "清空这题" })).toBeNull();
  fireEvent.changeText(screen.getByLabelText("期待的回答"), "我已经写好的合成回答");
  for (const question of ROOM_QUESTIONS[scenarioId]) {
    const card = within(screen.getByTestId(`room-question-${question.id}`));
    const examples = ROOM_ANSWER_GUIDES[scenarioId][question.id];
    expect(examples).toHaveLength(5);
    expect(new Set(examples).size).toBe(5);
    expect(card.getByText(question.prompt)).toBeTruthy();
    for (const example of [...examples, ...examples]) {
      expect(card.getByText(`示例回答：${example}`)).toBeTruthy();
      for (const other of examples.filter(value => value !== example)) expect(card.queryByText(`示例回答：${other}`)).toBeNull();
      fireEvent.press(card.getByRole("button", { name: `${question.title}：下一个引导` }));
      expect(screen.getByLabelText("期待的回答")).toHaveProp("value", "我已经写好的合成回答");
      expect(saveAnswer).not.toHaveBeenCalled();
    }
    expect(card.getByText(`示例回答：${examples[0]}`)).toBeTruthy();
    const otherQuestion = ROOM_QUESTIONS[scenarioId].find(other => other.id !== question.id)!;
    expect(within(screen.getByTestId(`room-question-${otherQuestion.id}`)).getByText(`示例回答：${ROOM_ANSWER_GUIDES[scenarioId][otherQuestion.id][0]}`)).toBeTruthy();
  }
  expect((await api.get(room.id)).myAnswers).toEqual({});
  for (const title of ["担忧", "边界", "回应与下一步"]) expect(screen.getByLabelText(`${title}的回答`)).toHaveProp("value", "");
});

test("manually deleting a saved answer still needs explicit saving and never offers a clear action", async () => {
  const api = createFakeRoomServer().forAccount("synthetic-room-guide-owner");
  const room = await api.create("pause");
  await api.saveAnswer(room.id, "expectation", "此前保存的合成回答");
  const saveAnswer = jest.fn(api.saveAnswer);
  render(<RoomDetailPage api={{ ...api, saveAnswer }} roomId={room.id} />);
  const answer = await screen.findByLabelText("期待的回答");
  fireEvent.changeText(answer, "");
  expect(screen.queryByRole("button", { name: "清空这题" })).toBeNull();
  expect(saveAnswer).not.toHaveBeenCalled();
  expect((await api.get(room.id)).myAnswers.expectation).toBe("此前保存的合成回答");
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "保存这题到云端" })); });
  expect(saveAnswer).toHaveBeenCalledWith(room.id, "expectation", "");
  expect((await api.get(room.id)).myAnswers.expectation).toBe("");
});

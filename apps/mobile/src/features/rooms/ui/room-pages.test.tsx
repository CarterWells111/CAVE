import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
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

test("room home keeps title and introduction above two side-by-side actions", () => {
  render(<RoomListPage />);
  const tree = JSON.stringify(screen.toJSON());
  expect(tree.indexOf('"房间"')).toBeLessThan(tree.indexOf("从一个情景开始"));
  expect(tree.indexOf("从一个情景开始")).toBeLessThan(tree.indexOf("加入房间"));
  expect(screen.getByTestId("room-primary-actions").props.style).toEqual(expect.objectContaining({ flexDirection: "row" }));
  fireEvent.press(screen.getByRole("button", { name: "加入房间" }));
  fireEvent.press(screen.getByRole("button", { name: "我的房间" }));
  fireEvent.press(screen.getByRole("button", { name: "选择说出暂停" }));
  expect(mockPush.mock.calls).toEqual([
    ["/join"],
    ["/rooms/mine"],
    [{ pathname: "/rooms/choose", params: { scenario: "pause" } }],
  ]);
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
  const roomButton = await screen.findByRole("button", { name: "说出暂停 · 待加入" });
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
  fireEvent.press(screen.getByRole("button", { name: "同意云端保存，新建说出暂停房间" }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: "/rooms/[roomId]", params: { roomId: "1" } }));
  expect((await api.get("1")).scenarioId).toBe("pause");
});

test("room permits skipped questions and waits for explicit report consent", async () => {
  const api = createFakeRoomServer().forAccount("alice");
  const room = await api.create("pause");
  render(<RoomDetailPage api={api} roomId={room.id} />);
  expect(await screen.findByText("说出暂停")).toBeTruthy();
  expect(screen.getAllByText(/可跳过/u)).toHaveLength(4);
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
  render(<RoomDetailPage api={bob} roomId={room.id} onDiscuss={onDiscuss} onRecord={onRecord} onExport={async () => undefined} />);
  expect(await screen.findByText("共同点与差异")).toBeTruthy();
  expect(screen.getByText("A 是房间发起人，B 是受邀者。")).toBeTruthy();
  expect(screen.getByText("给你们的建议")).toBeTruthy();
  expect(screen.getByText("接下来的建议")).toBeTruthy();
  expect(screen.queryByText(/可以说：/u)).toBeNull();
  expect(screen.getByRole("button", { name: "导出报告（图片）" })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "和内界AI详细聊聊" }));
  expect(onDiscuss).toHaveBeenCalledWith(expect.stringContaining("仍不确定的地方"), "adjust");
  fireEvent.press(screen.getByRole("button", { name: "记录此次沟通" }));
  expect(onRecord).toHaveBeenCalledWith(expect.stringContaining("共同点与差异"), room.id);
  expect(screen.queryByText("我的节奏")).toBeNull();
});

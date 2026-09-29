import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createFakeRoomServer } from "../infrastructure/fake-room-api";
import { RoomDetailPage } from "./room-pages";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useFocusEffect: (callback: () => void) => { const React = jest.requireActual<typeof import("react")>("react"); React.useEffect(callback, [callback]); },
}));

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

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

test("shared report labels A as host and B as invitee relative to the viewer", async () => {
  const server = createFakeRoomServer();
  const alice = server.forAccount("alice");
  const bob = server.forAccount("bob");
  const room = await alice.create("adjust");
  await bob.join(await alice.issueInvite(room.id));
  await alice.saveAnswer(room.id, "expectation", "我的节奏");
  await bob.saveAnswer(room.id, "boundary", "先询问");
  await alice.complete(room.id, true);
  await bob.complete(room.id, true);
  await bob.generateReport(room.id);
  render(<RoomDetailPage api={bob} roomId={room.id} />);
  expect(await screen.findByText("给发起人 A（给对方）：可以说 / 可以做")).toBeTruthy();
  expect(screen.getByText("给受邀者 B（给我）：可以说 / 可以做")).toBeTruthy();
  expect(screen.getByText("共同下一步")).toBeTruthy();
  expect(screen.getByText("不确定处")).toBeTruthy();
  expect(screen.queryByText("我的节奏")).toBeNull();
});

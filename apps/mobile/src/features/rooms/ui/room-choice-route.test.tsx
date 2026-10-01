import { act, fireEvent, render, screen } from "@testing-library/react-native";
import RoomChoiceRoute from "../../../../app/rooms/choose";

const mockPush = jest.fn();
const mockPrepareFirstOvernight = jest.fn(async (_runtime: unknown) => { void _runtime; return "/journey/body-knowledge"; });
let mockScenario = "first-overnight";
jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ scenario: mockScenario }), useRouter: () => ({ push: mockPush }) }));
jest.mock("../../journey/runtime/JourneyRuntimeProvider", () => ({ useOptionalJourneyRuntime: () => ({ service: {} }) }));
jest.mock("../../shell/application/journey-entry", () => ({ prepareFirstOvernight: (runtime: unknown) => mockPrepareFirstOvernight(runtime) }));

beforeEach(() => { jest.clearAllMocks(); mockScenario = "first-overnight"; });

test("single overnight resumes the existing journey only after choosing single", async () => {
  render(<RoomChoiceRoute />);
  expect(mockPrepareFirstOvernight).not.toHaveBeenCalled();
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "一个人探索" })); });
  expect(mockPrepareFirstOvernight).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith("/journey/body-knowledge");
});

test("duo choice enters the separate cloud gate without touching the single journey", () => {
  render(<RoomChoiceRoute />);
  fireEvent.press(screen.getByRole("button", { name: "双人一起探索" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/rooms/start", params: { scenario: "first-overnight" } });
  expect(mockPrepareFirstOvernight).not.toHaveBeenCalled();
});

test("single journey preparation failure stays on the choice page and can retry", async () => {
  mockPrepareFirstOvernight.mockRejectedValueOnce(new Error("private draft error"));
  render(<RoomChoiceRoute />);
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "一个人探索" })); });
  expect(await screen.findByText("操作失败，请检查网络后重试。")).toBeTruthy();
  expect(screen.queryByText("private draft error")).toBeNull();
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "一个人探索" })); });
  expect(mockPush).toHaveBeenCalledWith("/journey/body-knowledge");
});

test("new single scenarios keep their existing standalone practice behavior", async () => {
  mockScenario = "pause";
  render(<RoomChoiceRoute />);
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "一个人探索" })); });
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/practice/session", params: { scenario: "pause" } });
  expect(mockPrepareFirstOvernight).not.toHaveBeenCalled();
});

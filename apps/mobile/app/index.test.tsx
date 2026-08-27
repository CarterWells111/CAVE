import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import IndexRoute from "./index";

const mockReplace = jest.fn();
const mockLoad = jest.fn();
const mockRouter = { replace: mockReplace };
const mockShellState = { load: mockLoad };

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter
}));

jest.mock("../src/features/journey/runtime/JourneyRuntimeProvider", () => ({
  useJourneyRuntime: () => ({ shellState: mockShellState })
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test("cold starts the first-run journey when no completion marker exists", async () => {
  mockLoad.mockResolvedValueOnce(null);
  render(<IndexRoute />);

  expect(screen.getByText("正在打开内界 CAVE…")).toBeTruthy();
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/journey/welcome"));
});

test("cold starts the long-term home after the first journey is complete", async () => {
  mockLoad.mockResolvedValueOnce({
    initialJourneyId: "journey-1",
    initialJourneyCompletedAt: "2026-08-27T12:00:00.000Z"
  });
  render(<IndexRoute />);

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/(tabs)"));
  expect(mockReplace).not.toHaveBeenCalledWith("/journey/welcome");
});

test("keeps launch failure visible and retryable without leaking repository details", async () => {
  mockLoad
    .mockRejectedValueOnce(new Error("private database path"))
    .mockResolvedValueOnce(null);
  render(<IndexRoute />);

  expect(await screen.findByText("无法读取本机状态")).toBeTruthy();
  expect(screen.queryByText("private database path")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "重试" }));

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/journey/welcome"));
  expect(mockLoad).toHaveBeenCalledTimes(2);
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { ShellRouteGate } from "./ShellRouteGate";

const mockReplace = jest.fn();
const mockLoad = jest.fn();
const mockRouter = { replace: mockReplace };
const mockShellState = { load: mockLoad };

jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("../../journey/runtime/JourneyRuntimeProvider", () => ({
  useJourneyRuntime: () => ({ shellState: mockShellState })
}));

beforeEach(() => jest.clearAllMocks());

test("never reveals long-term navigation before a completion marker exists", async () => {
  mockLoad.mockResolvedValueOnce(null);
  render(<ShellRouteGate><Text>four-tabs</Text></ShellRouteGate>);

  expect(screen.queryByText("four-tabs")).toBeNull();
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/journey/welcome"));
  expect(screen.queryByText("four-tabs")).toBeNull();
});

test("renders long-term routes when the completion marker exists", async () => {
  mockLoad.mockResolvedValueOnce({ initialJourneyId: "journey-1", initialJourneyCompletedAt: "now" });
  render(<ShellRouteGate><Text>four-tabs</Text></ShellRouteGate>);

  expect(await screen.findByText("four-tabs")).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
});

test("keeps guard failures visible and retryable", async () => {
  mockLoad.mockRejectedValueOnce(new Error("private")).mockResolvedValueOnce({
    initialJourneyId: "journey-1",
    initialJourneyCompletedAt: "now"
  });
  render(<ShellRouteGate><Text>four-tabs</Text></ShellRouteGate>);

  expect(await screen.findByText("无法验证本机完成状态")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "重试" }));
  expect(await screen.findByText("four-tabs")).toBeTruthy();
});

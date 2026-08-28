import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { ShellRouteGate } from "./ShellRouteGate";

const mockReplace = jest.fn();
const mockLoad = jest.fn();
const mockRouter = { replace: mockReplace };
const mockShellState = { load: mockLoad };
const mockRedirect = jest.fn();
let mockRuntime: { shellState: typeof mockShellState } | null = { shellState: mockShellState };

jest.mock("expo-router", () => ({
  Redirect: (props: { href: string }) => {
    mockRedirect(props);
    return null;
  },
  useRouter: () => mockRouter
}));
jest.mock("../../journey/runtime/JourneyRuntimeProvider", () => ({
  useJourneyRuntime: () => mockRuntime,
  useOptionalJourneyRuntime: () => mockRuntime
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRuntime = { shellState: mockShellState };
});

test("redirects public tab deep links without reading private shell state", () => {
  mockRuntime = null;

  render(<ShellRouteGate><Text>four-tabs</Text></ShellRouteGate>);

  expect(mockRedirect).toHaveBeenCalledWith({ href: "/journey/welcome" });
  expect(mockLoad).not.toHaveBeenCalled();
  expect(screen.queryByText("four-tabs")).toBeNull();
});

test("allows long-term routes before a completion marker exists", async () => {
  mockLoad.mockResolvedValueOnce(null);
  render(<ShellRouteGate><Text>four-tabs</Text></ShellRouteGate>);

  expect(await screen.findByText("four-tabs")).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
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

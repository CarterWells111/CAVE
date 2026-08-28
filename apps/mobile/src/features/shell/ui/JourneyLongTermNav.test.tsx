import { fireEvent, render, screen } from "@testing-library/react-native";

import { JourneyLongTermNav } from "./JourneyLongTermNav";

const mockReplace = jest.fn();
const mockLoad = jest.fn();
const mockRouter = { replace: mockReplace };
const mockShellState = { load: mockLoad };
let mockRuntime: {
  shellState: typeof mockShellState;
  snapshot: { ageConfirmed: boolean } | null;
} | null = null;

jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("../../journey/runtime/JourneyRuntimeProvider", () => ({
  useOptionalJourneyRuntime: () => mockRuntime
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRuntime = null;
  mockLoad.mockReturnValue(new Promise<null>(() => undefined));
});

test("renders all four tabs publicly without consulting runtime or private shell state", () => {
  render(<JourneyLongTermNav activeTab="home" />);

  expect(screen.getAllByRole("tab")).toHaveLength(4);
  expect(mockLoad).not.toHaveBeenCalled();
});

test("keeps the same immediate navigation when an authorized runtime exists", () => {
  mockRuntime = { shellState: mockShellState, snapshot: { ageConfirmed: true } };
  render(<JourneyLongTermNav activeTab="home" />);

  expect(screen.getAllByRole("tab")).toHaveLength(4);
  expect(mockLoad).not.toHaveBeenCalled();
});

test("routes each public tab destination", () => {
  render(<JourneyLongTermNav activeTab="practice" />);

  fireEvent.press(screen.getByRole("tab", { name: "首页" }));
  fireEvent.press(screen.getByRole("tab", { name: "回顾" }));
  fireEvent.press(screen.getByRole("tab", { name: "练习" }));
  fireEvent.press(screen.getByRole("tab", { name: "我的" }));

  expect(mockReplace.mock.calls).toEqual([
    ["/(tabs)"],
    ["/(tabs)/reviews"],
    ["/(tabs)/practice"],
    ["/(tabs)/profile"]
  ]);
  expect(mockLoad).not.toHaveBeenCalled();
});

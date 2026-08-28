import { render, screen, waitFor } from "@testing-library/react-native";

import IndexRoute from "../../../app/index";

const mockReplace = jest.fn();
const mockLoad = jest.fn();
const mockRouter = { replace: mockReplace };
const mockShellState = { load: mockLoad };

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter
}));

jest.mock("../journey/runtime/JourneyRuntimeProvider", () => ({
  useJourneyRuntime: () => ({ shellState: mockShellState })
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test("always opens the public landing without reading private shell state", async () => {
  render(<IndexRoute />);

  expect(screen.getByText("正在打开内界 CAVE…")).toBeTruthy();
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/journey/welcome"));
  expect(mockLoad).not.toHaveBeenCalled();
});

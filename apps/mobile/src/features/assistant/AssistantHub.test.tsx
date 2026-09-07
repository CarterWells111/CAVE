import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text as MockText } from "react-native";
import { AssistantHub } from "./AssistantHub";
const mockPush = jest.fn();
let mockAdult = "public";
const mockPanel = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("../journey/runtime/JourneyRuntimeProvider", () => ({ useAdultDeclaration: () => ({ status: mockAdult }) }));
jest.mock("../auth/runtime/AuthProvider", () => ({ useOptionalAuth: () => ({ status: "signedOut" }) }));
jest.mock("./AssistantPanel", () => ({ AssistantPanel: (props: unknown) => { mockPanel(props); return <MockText>问答面板</MockText>; } }));
beforeEach(() => { jest.clearAllMocks(); mockAdult = "public"; });
test("public AI explains its purpose and offers adult declaration without reading journals", () => {
  render(<AssistantHub />);
  expect(screen.getByRole("header", { name: "AI" })).toBeTruthy();
  expect(mockPanel).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "成年声明后开始问答" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/journey/adult-gate", params: { entry: "ai" } });
});
test("AI entry offers scoped journal actions and journey questions with no private records", () => {
  mockAdult = "authorized";
  render(<AssistantHub />);
  fireEvent.press(screen.getByRole("button", { name: "带我开始一条手记" }));
  fireEvent.press(screen.getByRole("button", { name: "选择手记进行回顾" }));
  fireEvent.press(screen.getByRole("button", { name: "登录以使用在线 AI" }));
  expect(mockPush.mock.calls).toEqual([["/journal/new"], ["/journal/review"], [{ pathname: "/auth/email", params: { returnTo: "/(tabs)/ai" } }]]);
  expect(mockPanel).toHaveBeenCalledWith({ records: [], modes: ["journey"], journeyId: "first-overnight" });
});

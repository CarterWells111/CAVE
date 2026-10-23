import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { AssistantUsage } from "@cave/contracts";
import { AssistantUsageMeter, remainingUsagePercent } from "./assistant-usage-meter";
jest.mock("../auth/runtime/AuthProvider", () => ({ useOptionalAuth: () => ({ accountId: "a" }) }));
const usage: AssistantUsage = { hour: { used: 2, limit: 10, resetsAt: "2026-09-09T13:00:00.000Z" }, day: { used: 5, limit: 100, resetsAt: "2026-09-10T00:00:00.000Z" }, measuredAt: "2026-09-09T12:30:00.000Z" };
test("meter shows the lowest remaining percentage and opens remaining hour/day details", async () => {
  const loadUsage = jest.fn(async () => usage);
  const view = render(<AssistantUsageMeter revision={0} preview={false} loadUsage={loadUsage} />);
  fireEvent.press(await screen.findByRole("button", { name: "查看 AI 用量，剩余 80%" }));
  expect(await screen.findByText("每小时 · 剩余 80%")).toBeTruthy();
  expect(screen.getByText("每天 · 剩余 95%")).toBeTruthy();
  expect(screen.getByText(/剩余 8 次 \/ 10 次/)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "知道了，继续聊" }));
  loadUsage.mockResolvedValue({ ...usage, day: { ...usage.day, used: 100 } });
  view.rerender(<AssistantUsageMeter revision={1} preview={false} loadUsage={loadUsage} />);
  expect(await screen.findByRole("button", { name: "查看 AI 用量，剩余 0%" })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "查看 AI 用量，剩余 0%" }));
  expect(await screen.findByText("每天 · 剩余 0%")).toBeTruthy();
});
test("unset limits display pending rather than a fabricated zero percent", async () => {
  const loadUsage = async () => ({ ...usage, hour: { ...usage.hour, limit: null }, day: { ...usage.day, limit: null } });
  render(<AssistantUsageMeter revision={0} preview={false} loadUsage={loadUsage} />);
  await act(async () => undefined);
  fireEvent.press(screen.getByRole("button", { name: "查看 AI 用量，额度待设置" }));
  expect(await screen.findByText("每小时 · 额度待设置")).toBeTruthy();
  expect(screen.queryByText("剩余 0%")).toBeNull();
});
test("remaining percentages include full allowance, exhaustion and over-limit use", () => {
  expect(remainingUsagePercent(0, 100)).toBe(100);
  expect(remainingUsagePercent(100, 100)).toBe(0);
  expect(remainingUsagePercent(150, 100)).toBe(0);
  expect(remainingUsagePercent(1, 3)).toBe(67);
  expect(remainingUsagePercent(1, null)).toBeNull();
});
test("a configured window still controls remaining quota when the other limit is unset", async () => {
  const loadUsage = async () => ({ ...usage, hour: { ...usage.hour, limit: null } });
  render(<AssistantUsageMeter revision={0} preview={false} loadUsage={loadUsage} />);
  expect(await screen.findByRole("button", { name: "查看 AI 用量，剩余 95%" })).toBeTruthy();
});
test("failed usage load has retry and preview never queries the cloud", async () => {
  const loadUsage = jest.fn(async () => { throw new Error("offline"); });
  const view = render(<AssistantUsageMeter revision={0} preview={false} loadUsage={loadUsage} />);
  fireEvent.press(await screen.findByRole("button", { name: "查看 AI 用量，暂时无法获取用量" }));
  expect(await screen.findByRole("button", { name: "重新获取用量" })).toBeTruthy();
  view.unmount(); loadUsage.mockClear();
  render(<AssistantUsageMeter revision={0} preview loadUsage={loadUsage} />);
  await act(async () => undefined);
  expect(loadUsage).not.toHaveBeenCalled();
});

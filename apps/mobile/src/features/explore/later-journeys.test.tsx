import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import { SAMPLE_JOURNEYS } from "./catalog";
import { InMemoryPreferenceCardRepository } from "./preference-card";
import { SampleJourneyScreen } from "./ui/sample-journey-screen";

const next = () => fireEvent.press(screen.getByRole("button", { name: "下一页" }));

it("opens the 05 practical cards only when requested", () => {
  render(<SampleJourneyScreen journey={SAMPLE_JOURNEYS[4]!} onExit={jest.fn()} />);
  next();
  expect(screen.getByText("照顾身体，处理意外")).toBeTruthy();
  expect(screen.queryByText(/紧急避孕有时间窗口/u)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "保护出现意外，展开" }));
  expect(screen.getByText(/紧急避孕有时间窗口/u)).toBeTruthy();
  expect(screen.getByRole("button", { name: "查看 NHS 紧急避孕资料" })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "保护出现意外，收起" }));
  expect(screen.queryByText(/紧急避孕有时间窗口/u)).toBeNull();
});

it("saves a private preference card in 04 and lets 06 edit the same account's copy", async () => {
  const repository = new InMemoryPreferenceCardRepository();
  const shared = {
    onExit: jest.fn(),
    preferenceCards: repository,
    preferenceCardOwner: "account-a",
    preferenceCardPersistence: "sqlcipher-secure-store" as const,
  };
  const first = render(<SampleJourneyScreen journey={SAMPLE_JOURNEYS[3]!} {...shared} />);
  next();
  next();
  await screen.findByLabelText("愿意了解或尝试的方式");
  fireEvent.changeText(screen.getByLabelText("需要先谈好的保护条件"), "先讨论屏障方式");
  fireEvent.press(screen.getByRole("button", { name: "保存偏好卡" }));
  await waitFor(() => expect(screen.getByText("偏好卡已保存在本机，可随时回来修改。")).toBeTruthy());
  expect(screen.getByText("我的个人偏好卡")).toBeTruthy();
  expect(screen.getByText("先讨论屏障方式")).toBeTruthy();
  first.unmount();

  render(<SampleJourneyScreen journey={SAMPLE_JOURNEYS[5]!} {...shared} />);
  next();
  next();
  expect(await screen.findByDisplayValue("先讨论屏障方式")).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText("需要先谈好的保护条件"), "先讨论避孕和屏障方式");
  fireEvent.press(screen.getByRole("button", { name: "保存更改" }));
  await waitFor(async () => {
    expect((await repository.load("account-a"))?.protection).toBe("先讨论避孕和屏障方式");
  });
  expect(await repository.load("account-b")).toBeNull();
});

it("warns before discarding unsaved preference card edits", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  try {
    const exit = jest.fn();
    render(<SampleJourneyScreen
      journey={SAMPLE_JOURNEYS[3]!}
      onExit={exit}
      preferenceCards={new InMemoryPreferenceCardRepository()}
      preferenceCardOwner="account-a"
      preferenceCardPersistence="memory-only"
    />);
    next();
    next();
    await screen.findByLabelText("暂时不想要的方式");
    fireEvent.changeText(screen.getByLabelText("暂时不想要的方式"), "今天不想要纳入");
    fireEvent.press(screen.getByRole("button", { name: "返回地图" }));
    expect(exit).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith("偏好卡尚未保存", expect.any(String), expect.any(Array));
    const actions = alert.mock.calls.at(-1)?.[2];
    act(() => actions?.find(({ text }) => text === "放弃修改")?.onPress?.());
    expect(exit).toHaveBeenCalledTimes(1);
  } finally {
    alert.mockRestore();
  }
});

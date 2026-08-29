import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { darkTheme as theme } from "../../../../core/design/theme";
import { BottomSheet } from "../../../../core/ui/bottom-sheet";
import { PrefaceWelcomeSheet } from "./preface-welcome-sheet";

const welcomeParagraphs = [
  "遇见喜欢的人，听到某句情话，或面对某种爱抚与刺激时，身体可能会自然作出反应。这些反应可能让妳好奇，也可能让妳不适，甚至觉得不可接受。",
  "无论是哪一种，妳都可以从认识身体与同意开始，慢慢形成自己对性与亲密的理解。",
  "我们知道，界面里的文字不一定能完整托住妳的经历，也不会替妳下结论。希望它们可以成为一个起点：妳可以记下此刻的感受，在情境练习里试着说出一句话，也可以在安全、独处时对着镜子练习。",
  "这不是为了让妳表现得更大胆，而是让那些过去没有被看见的需要与声音，更容易先被妳自己听见，再由妳决定是否告诉别人。",
] as const;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test("shows the restored welcome note for the persisted form of address", () => {
  const { UNSAFE_getByType } = render(
    <PrefaceWelcomeSheet onConfirm={jest.fn()} preference="妳" visible />,
  );

  expect(UNSAFE_getByType(BottomSheet).props).toEqual(expect.objectContaining({
    dismissible: false,
    title: "欢迎来到内界 CAVE",
    visible: true,
  }));
  expect(screen.getByRole("header", { name: "欢迎来到内界 CAVE" })).toBeTruthy();
  for (const paragraph of welcomeParagraphs) {
    expect(screen.getByText(paragraph)).toHaveProp("selectable", true);
    expect(screen.getByText(paragraph)).toHaveStyle({
      ...theme.typography.body,
      color: theme.color.text,
    });
  }
  expect(screen.getAllByRole("button")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "我已了解，开始旅程" })).toBeTruthy();
  expect(screen.queryByText(/先跳过/u)).toBeNull();
  expect(screen.queryByRole("button", { name: /关闭/u })).toBeNull();
});

test("substitutes the persisted 你 preference throughout the approved note", () => {
  render(<PrefaceWelcomeSheet onConfirm={jest.fn()} preference="你" visible />);

  for (const paragraph of welcomeParagraphs) {
    expect(screen.getByText(paragraph.replaceAll("妳", "你"))).toBeTruthy();
  }
  expect(screen.queryByText(/妳/u)).toBeNull();
});

test("keeps the sheet open, shows a safe error, and allows a loading retry", async () => {
  const retry = deferred<void>();
  const onConfirm = jest.fn()
    .mockRejectedValueOnce(new Error("private persistence detail"))
    .mockImplementationOnce(() => retry.promise);
  render(<PrefaceWelcomeSheet onConfirm={onConfirm} preference="你" visible />);

  fireEvent.press(screen.getByRole("button", { name: "我已了解，开始旅程" }));
  expect(await screen.findByText("阅读状态暂时无法保存，请重试。")).toBeTruthy();
  expect(screen.queryByText("private persistence detail")).toBeNull();
  expect(screen.getByTestId("bottom-sheet-modal")).toHaveProp("visible", true);

  fireEvent.press(screen.getByRole("button", { name: "我已了解，开始旅程" }));
  expect(screen.getByRole("button", { name: "正在进入旅程…" })).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ busy: true, disabled: true }),
  );
  expect(onConfirm).toHaveBeenCalledTimes(2);

  await act(async () => retry.resolve());
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "我已了解，开始旅程" })).toBeTruthy();
  });
});

import { render, screen } from "@testing-library/react-native";

import { UnderageExitPage } from "./underage-exit-page";

test("blocks underage users with only a static instruction to close the app", () => {
  render(<UnderageExitPage />);

  expect(screen.getByRole("header", { name: "此内容仅限成年人" })).toBeTruthy();
  expect(screen.getByText("你未满 18 岁，无法继续使用。请关闭 App。")).toBeTruthy();
  expect(screen.queryAllByRole("button")).toHaveLength(0);
  expect(screen.queryByText(/内界|CAVE|旅程|称呼|返回/u)).toBeNull();
});

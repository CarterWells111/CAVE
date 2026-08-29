import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { PrefacePage } from "./preface-page";

test("requires a chosen form of address before saving it", async () => {
  const onContinue = jest.fn(async () => undefined);
  render(<PrefacePage onContinue={onContinue} />);

  expect(screen.getByRole("header", { name: "开始前，想告诉你" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "这样称呼我" })).toHaveProp(
    "accessibilityState", expect.objectContaining({ disabled: true }),
  );
  fireEvent.press(screen.getByRole("radio", { name: "妳｜明确称呼女性，更有书信感。" }));
  fireEvent.press(screen.getByRole("button", { name: "这样称呼我" }));
  await waitFor(() => expect(onContinue).toHaveBeenCalledWith("妳"));
});

test("does not mention login or adult verification before the first knowledge page", () => {
  render(<PrefacePage onContinue={jest.fn()} />);
  expect(screen.queryByText(/邮箱|验证码|登录|年满 18/u)).toBeNull();
  expect(screen.queryByText(/之后仍可调整/u)).toBeNull();
});

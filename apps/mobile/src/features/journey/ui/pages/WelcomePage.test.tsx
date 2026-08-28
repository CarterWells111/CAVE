import { fireEvent, render, screen } from "@testing-library/react-native";

import { WelcomePage } from "./WelcomePage";

test("shows one journey action and a top-right help action without age or login prompts", () => {
  const onStart = jest.fn();
  render(<WelcomePage onStart={onStart} resumeAvailable={false} />);

  expect(screen.getByRole("button", { name: "开启旅程" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "帮助" })).toBeTruthy();
  expect(screen.queryByText(/18|成年|登录|邮箱|验证码/u)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "开启旅程" }));
  expect(onStart).toHaveBeenCalledTimes(1);
});

test("help explains product scope, 18+ gate, non-diagnosis and local-first privacy", () => {
  render(<WelcomePage onStart={jest.fn()} resumeAvailable={false} />);
  fireEvent.press(screen.getByRole("button", { name: "帮助" }));

  expect(screen.getByRole("header", { name: "关于内界 CAVE" })).toBeTruthy();
  expect(screen.getByText(/亲密关系中的身体、安全、边界与沟通/u)).toBeTruthy();
  expect(screen.getByText(/点击“开启旅程”后.*本机.*年满 18 岁的自我声明/u)).toBeTruthy();
  expect(screen.getByText(/声明后.*“开始前，想告诉你”.*六页正式内容/u)).toBeTruthy();
  expect(screen.getByText(/不是身份核验.*不是真实年龄核验/u)).toBeTruthy();
  expect(screen.getByText(/不收集.*生日.*证件.*邮箱/u)).toBeTruthy();
  expect(screen.getByText(/不提供医疗诊断/u)).toBeTruthy();
  expect(screen.getByText(/旅程记录以本机保存为先/u)).toBeTruthy();
  expect(screen.queryByText(/身体与安全知识可以先阅读/u)).toBeNull();
  expect(screen.queryByText(/验证码|登录|账号|多设备/u)).toBeNull();
});

test("uses a continue label when an unfinished local journey exists", () => {
  const onResume = jest.fn();
  render(<WelcomePage onStart={jest.fn()} onResume={onResume} resumeAvailable />);

  expect(screen.queryByRole("button", { name: "开启旅程" })).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "继续旅程" }));
  expect(onResume).toHaveBeenCalledTimes(1);
});

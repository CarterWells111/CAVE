import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { darkTheme } from "../../../../core/design/theme";
import { WelcomePage } from "./WelcomePage";

test("shows one journey action and a top-right help action without age or login prompts", () => {
  const onStart = jest.fn();
  render(<WelcomePage onStart={onStart} resumeAvailable={false} />);

  expect(screen.getByRole("button", { name: "开启旅程" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "帮助" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "设置" })).toBeNull();
  expect(screen.queryByText(/18|成年|登录|邮箱|验证码/u)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "开启旅程" }));
  expect(onStart).toHaveBeenCalledTimes(1);
});

test("opens settings whenever its public or authorized route supplies the action", () => {
  const onOpenSettings = jest.fn();
  render(<WelcomePage onOpenSettings={onOpenSettings} onStart={jest.fn()} resumeAvailable />);

  fireEvent.press(screen.getByRole("button", { name: "设置" }));
  expect(onOpenSettings).toHaveBeenCalledTimes(1);
});

test("help explains product scope, 18+ gate, non-diagnosis and local-first privacy", () => {
  render(<WelcomePage onStart={jest.fn()} resumeAvailable={false} />);
  fireEvent.press(screen.getByRole("button", { name: "帮助" }));

  expect(screen.getByRole("header", { name: "关于内界 CAVE" })).toBeTruthy();
  expect(screen.getByText(/亲密关系中的身体、安全、边界与沟通/u)).toBeTruthy();
  expect(screen.getByText(/点击“开启旅程”后.*本机.*年满 18 岁的自我声明/u)).toBeTruthy();
  expect(screen.getByText(/声明后.*“开始前，想告诉你”.*五页正式内容/u)).toBeTruthy();
  expect(screen.getByText(/不是身份核验.*不是真实年龄核验/u)).toBeTruthy();
  expect(screen.getByText(/不收集.*生日.*证件.*邮箱/u)).toBeTruthy();
  expect(screen.getByText(/不提供医疗诊断/u)).toBeTruthy();
  expect(screen.getByText(/旅程记录以本机保存为先/u)).toBeTruthy();
  expect(screen.queryByText(/身体与安全知识可以先阅读/u)).toBeNull();
  expect(screen.queryByText(/验证码|登录|账号|多设备/u)).toBeNull();
});

test("shows the AI assistance disclosure only inside help", () => {
  render(<WelcomePage onStart={jest.fn()} resumeAvailable={false} />);

  expect(screen.queryByText(/部分页面内容由 AI 辅助生成/u)).toBeNull();

  fireEvent.press(screen.getByRole("button", { name: "帮助" }));

  expect(screen.getByText(/部分页面内容由 AI 辅助生成，并经团队编辑审核/u)).toBeTruthy();
  expect(screen.getByText(/AI 辅助、团队编辑审核和免责声明都不能代替医疗、安全及紧急支持内容所需的专业审核/u)).toBeTruthy();
});

test("uses a continue label when an unfinished local journey exists", () => {
  const onResume = jest.fn();
  render(<WelcomePage onOpenSettings={jest.fn()} onStart={jest.fn()} onResume={onResume} resumeAvailable />);

  expect(screen.queryByRole("button", { name: "开启旅程" })).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "继续旅程" }));
  expect(onResume).toHaveBeenCalledTimes(1);
});

test("keeps the original landing rhythm without pushing or shrinking the primary action", () => {
  render(<WelcomePage onStart={jest.fn()} resumeAvailable={false} />);

  const landingStyle = StyleSheet.flatten(screen.getByTestId("welcome-landing").props.style);
  const brandStyle = StyleSheet.flatten(screen.getByTestId("welcome-brand").props.style);
  const actionsStyle = StyleSheet.flatten(screen.getByTestId("welcome-actions").props.style);
  const primaryActionStyle = StyleSheet.flatten(
    screen.getByRole("button", { name: "开启旅程" }).props.style,
  );

  expect(landingStyle.gap).toBe(darkTheme.space.lg);
  expect(brandStyle.paddingTop).toBe(darkTheme.space.card);
  expect(actionsStyle.gap).toBe(darkTheme.space.compact);
  expect(actionsStyle.marginTop).toBeUndefined();
  expect(primaryActionStyle.minHeight).toBe(darkTheme.size.primaryActionHeight);
  expect(primaryActionStyle.minHeight).toBe(52);
});

test("reflows only external brand space on constrained screens", () => {
  render(
    <WelcomePage
      brandPaddingTop={0}
      layout="inline-brand"
      onStart={jest.fn()}
      resumeAvailable={false}
    />,
  );

  const landingStyle = StyleSheet.flatten(screen.getByTestId("welcome-landing").props.style);
  const brandStyle = StyleSheet.flatten(screen.getByTestId("welcome-brand").props.style);
  const brandNamesStyle = StyleSheet.flatten(screen.getByTestId("welcome-brand-names").props.style);
  const cardStyle = StyleSheet.flatten(screen.getByTestId("welcome-intro-card").props.style);
  const primaryActionStyle = StyleSheet.flatten(
    screen.getByRole("button", { name: "开启旅程" }).props.style,
  );

  expect(landingStyle.gap).toBe(darkTheme.space.lg);
  expect(brandStyle.paddingTop).toBe(0);
  expect(brandNamesStyle.flexDirection).toBe("row");
  expect(cardStyle.gap).toBe(darkTheme.space.md);
  expect(cardStyle.padding).toBe(darkTheme.space.lg);
  expect(primaryActionStyle.minHeight).toBe(52);
});

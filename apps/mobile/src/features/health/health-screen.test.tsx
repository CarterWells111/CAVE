import { render, screen } from "@testing-library/react-native";

import { HealthScreen } from "./health-screen";

describe("HealthScreen", () => {
  it("displays the approved brand and build identity", () => {
    render(
      <HealthScreen
        build="local"
        environment="development"
        version="0.1.0"
      />
    );

    expect(screen.getByText("内界 CAVE")).toBeOnTheScreen();
    expect(screen.getByText("听见身体，确认边界。")).toBeOnTheScreen();
    expect(screen.getByText("version 0.1.0")).toBeOnTheScreen();
    expect(screen.getByText("build local")).toBeOnTheScreen();
    expect(screen.getByText("development")).toBeOnTheScreen();
  });
});

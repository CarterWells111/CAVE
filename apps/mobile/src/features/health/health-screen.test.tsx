import { render, screen } from "@testing-library/react-native";

import { HealthScreen } from "./health-screen";

describe("HealthScreen", () => {
  it("displays the development environment", () => {
    render(
      <HealthScreen
        build="local"
        environment="development"
        version="0.0.0"
      />
    );

    expect(screen.getByText("development")).toBeOnTheScreen();
  });
});

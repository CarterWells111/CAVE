import { render, screen } from "@testing-library/react-native";

import { darkTheme } from "../design/theme";
import { PageHeader, PageTitle } from "./page-header";

test("custom page titles match PageHeader typography and keep room for header actions", () => {
  render(<><PageTitle>内界 AI</PageTitle><PageHeader title="房间" /></>);

  for (const title of ["内界 AI", "房间"]) {
    const heading = screen.getByRole("header", { name: title });
    expect(heading).toHaveStyle({
      ...darkTheme.typography.title,
      color: darkTheme.color.text,
      flex: 1,
      flexShrink: 1,
    });
    expect(heading).toHaveProp("selectable", true);
  }
});
import contentPackage from "../../../../packages/content/package.json";
import contractsPackage from "../../../../packages/contracts/package.json";
import mobilePackage from "../../package.json";

jest.mock("expo/metro-config", () => ({
  getDefaultConfig: () => ({ resolver: {} }),
}));

type MetroConfig = {
  resolver?: {
    blockList?: RegExp | RegExp[];
  };
};

describe("Metro workspace dependencies", () => {
  it("declares source-workspace runtime dependencies at the mobile bundle boundary", () => {
    const mobileDependencies = mobilePackage.dependencies as Record<
      string,
      string | undefined
    >;

    expect(mobileDependencies.zod).toBe(contentPackage.dependencies.zod);
    expect(mobileDependencies.zod).toBe(contractsPackage.dependencies.zod);
  });

  it("excludes sibling Git worktrees from Metro file watching", () => {
    const metroConfig = jest.requireActual("../../metro.config.cjs") as MetroConfig;
    const blockList = metroConfig.resolver?.blockList;
    const expressions = Array.isArray(blockList) ? blockList : [blockList];

    expect(
      expressions.some((expression) =>
        expression?.test("C:\\repo\\.worktrees\\other-branch\\node_modules\\package"),
      ),
    ).toBe(true);
  });
});

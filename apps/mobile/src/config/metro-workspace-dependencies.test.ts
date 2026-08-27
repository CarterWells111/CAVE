import contentPackage from "../../../../packages/content/package.json";
import contractsPackage from "../../../../packages/contracts/package.json";
import mobilePackage from "../../package.json";

describe("Metro workspace dependencies", () => {
  it("declares source-workspace runtime dependencies at the mobile bundle boundary", () => {
    const mobileDependencies = mobilePackage.dependencies as Record<
      string,
      string | undefined
    >;

    expect(mobileDependencies.zod).toBe(contentPackage.dependencies.zod);
    expect(mobileDependencies.zod).toBe(contractsPackage.dependencies.zod);
  });
});

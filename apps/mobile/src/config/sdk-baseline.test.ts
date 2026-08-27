import packageJson from "../../package.json";

describe("Expo SDK baseline", () => {
  it("uses the approved SDK 54 dependency matrix", () => {
    expect(packageJson.dependencies.expo).toMatch(/^~54\./u);
    expect(packageJson.dependencies.react).toBe("19.1.0");
    expect(packageJson.dependencies["react-native"]).toMatch(/^0\.81\./u);
    expect(packageJson.dependencies["expo-router"]).toMatch(/^~6\./u);
    expect(
      (packageJson.dependencies as Record<string, string | undefined>)[
        "@expo/metro-runtime"
      ]
    ).toMatch(/^~6\.1\./u);
    expect(packageJson.devDependencies["jest-expo"]).toMatch(/^~54\./u);
  });
});

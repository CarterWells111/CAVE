import packageJson from "../../package.json";

describe("Expo SDK baseline", () => {
  it("uses the approved SDK 54 dependency matrix", () => {
    expect(packageJson.dependencies.expo).toBe("~54.0.37");
    expect(packageJson.dependencies.react).toBe("19.1.0");
    expect(packageJson.dependencies["react-native"]).toBe("0.81.5");
    expect(packageJson.dependencies["expo-router"]).toBe("~6.0.24");
    expect(
      (packageJson.dependencies as Record<string, string | undefined>)[
        "@expo/metro-runtime"
      ]
    ).toBe("~6.1.2");
    expect(packageJson.devDependencies["jest-expo"]).toBe("~54.0.18");
  });
});

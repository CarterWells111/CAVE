import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import packageJson from "../../package.json";
import tsconfig from "../../tsconfig.json";

const pnpmWorkspace = readFileSync(
  resolve(__dirname, "../../../../pnpm-workspace.yaml"),
  "utf8"
);

describe("Expo SDK baseline", () => {
  it("uses the approved SDK 57 dependency matrix", () => {
    expect(packageJson.dependencies.expo).toBe("~57.0.20");
    expect(packageJson.dependencies.react).toBe("19.2.3");
    expect(packageJson.dependencies["react-native"]).toBe("0.86.3");
    expect(packageJson.dependencies["expo-router"]).toBe("~57.0.19");
    expect(packageJson.dependencies["expo-dev-client"]).toBe("~57.0.18");
    expect(
      (packageJson.dependencies as Record<string, string | undefined>)[
        "expo-splash-screen"
      ]
    ).toBe("~57.0.8");
    expect(packageJson.dependencies["expo-system-ui"]).toBe("~57.0.3");
    expect(packageJson.dependencies["@expo/vector-icons"]).toBe("^15.1.1");
    expect(
      (packageJson.dependencies as Record<string, string | undefined>)[
        "@expo/metro-runtime"
      ]
    ).toBe("~57.0.15");
    expect(packageJson.devDependencies["@expo/router-server"]).toBe(
      "~57.0.9"
    );
    expect(packageJson.devDependencies["expo-server"]).toBe("~57.0.3");
    expect(
      (packageJson.devDependencies as Record<string, string | undefined>)[
        "@types/node"
      ]
    ).toBe("~24.13.3");
    expect(packageJson.devDependencies["jest-expo"]).toBe("~57.0.5");
    expect(packageJson.scripts.start).toBe("expo start --go");
    expect(packageJson.scripts["start:dev-client"]).toBe(
      "expo start --dev-client"
    );
    expect(tsconfig.compilerOptions.types).toContain("node");
  });

  it("supplies datetimepicker's missing Expo config-plugin dependency for pnpm", () => {
    expect(pnpmWorkspace).toMatch(
      /"@react-native-community\/datetimepicker@9\.1\.0":\r?\n\s+dependencies:\r?\n\s+"@expo\/config-plugins": "57\.0\.9"/
    );
  });
});

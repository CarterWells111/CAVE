import type { ConfigContext, ExpoConfig } from "expo/config";

function getEnvironment() {
  return process.env.EAS_BUILD_PROFILE ?? "development";
}

function getDisplayName(environment: string) {
  if (environment === "production") {
    return "内界 CAVE";
  }

  if (environment === "preview") {
    return "内界 CAVE Preview";
  }

  return "内界 CAVE Dev";
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const environment = getEnvironment();

  return {
    ...config,
    name: getDisplayName(environment),
    owner: "carter_wells",
    slug: "cave",
    version: "0.1.0",
    scheme: "cave",
    orientation: "portrait",
    plugins: ["expo-router"],
    experiments: {
      typedRoutes: true
    },
    ios: {
      bundleIdentifier: "com.neijie.cave",
      supportsTablet: false
    },
    extra: {
      eas: {
        projectId: "1ddc0761-af43-491c-b969-ec2f6c415013"
      },
      build: process.env.EAS_BUILD_ID ?? "local",
      environment
    }
  };
};

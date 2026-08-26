import type { ConfigContext, ExpoConfig } from "expo/config";

function getEnvironment() {
  return process.env.EAS_BUILD_PROFILE ?? "development";
}

function getDisplayName(environment: string) {
  if (environment === "production") {
    return "Body Voice";
  }

  return `Body Voice (${environment})`;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const environment = getEnvironment();

  return {
    ...config,
    name: getDisplayName(environment),
    slug: "body-voice",
    version: "0.0.0",
    scheme: "bodyvoice",
    orientation: "portrait",
    plugins: ["expo-router"],
    experiments: {
      typedRoutes: true
    },
    ios: {
      bundleIdentifier: "com.shenicest.bodyvoice",
      supportsTablet: false
    },
    android: {
      package: "com.shenicest.bodyvoice"
    },
    extra: {
      build: process.env.EAS_BUILD_ID ?? "local",
      environment
    }
  };
};

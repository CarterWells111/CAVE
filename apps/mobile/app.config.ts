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
    userInterfaceStyle: "automatic",
    plugins: [
      "expo-router",
      "expo-system-ui",
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#1B0D1F"
        }
      ],
      ["expo-sqlite", { useSQLCipher: true }],
      [
        "expo-secure-store",
        {
          configureAndroidBackup: false,
          faceIDPermission: "允许内界 CAVE 保护仅存储在此设备上的私密练习数据。"
        }
      ],
      [
        "expo-media-library",
        {
          photosPermission: "允许内界 CAVE 访问你选择的照片，以便管理你主动保存的沟通卡图片。",
          savePhotosPermission: "允许内界 CAVE 将你确认的沟通卡图片保存到本机相册。",
          granularPermissions: ["photo"]
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "允许内界 CAVE 访问你选择的照片，以便更改仅保存在本机的账号头像。",
          cameraPermission: false,
          microphonePermission: false
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    },
    ios: {
      icon: "./assets/app-icon.png",
      bundleIdentifier: "com.neijie.cave",
      supportsTablet: false,
      config: {
        usesNonExemptEncryption: false
      }
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

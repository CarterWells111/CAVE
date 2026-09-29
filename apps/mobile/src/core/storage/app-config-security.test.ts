import type { ConfigContext } from "expo/config";

import getConfig from "../../../app.config";

test("configures iOS SQLCipher and SecureStore without plaintext fallback", () => {
  const config = getConfig({ config: {} } as ConfigContext);

  expect(config.plugins).toContainEqual(["expo-sqlite", { useSQLCipher: true }]);
  expect(config.plugins).toContainEqual([
    "expo-secure-store",
    expect.objectContaining({ configureAndroidBackup: false })
  ]);
  expect(config.ios?.config?.usesNonExemptEncryption).toBe(false);
  expect(config.android).toBeUndefined();
});

test("local HTTP permission exists only in development and acceptance builds", () => {
  const originalProfile = process.env.EAS_BUILD_PROFILE;
  try {
    for (const profile of ["development", "acceptance", "preview", "production"]) {
      process.env.EAS_BUILD_PROFILE = profile;
      const infoPlist = getConfig({ config: {} } as ConfigContext).ios?.infoPlist;
      if (profile === "development" || profile === "acceptance") {
        expect(infoPlist?.NSAppTransportSecurity).toEqual({ NSAllowsLocalNetworking: true });
        expect(infoPlist?.NSLocalNetworkUsageDescription).toContain("Gateway");
      } else {
        expect(infoPlist).toBeUndefined();
      }
    }
  } finally {
    if (originalProfile === undefined) delete process.env.EAS_BUILD_PROFILE;
    else process.env.EAS_BUILD_PROFILE = originalProfile;
  }
});

test("allows native light and dark appearance changes on both platforms", () => {
  const config = getConfig({ config: {} } as ConfigContext);

  expect(config.userInterfaceStyle).toBe("automatic");
  expect(config.plugins).toContain("expo-system-ui");
});

test("registers the native config plugins required by SDK 57", () => {
  const config = getConfig({ config: {} } as ConfigContext);

  expect(config.plugins).toEqual(
    expect.arrayContaining([
      "@react-native-community/datetimepicker",
      "expo-font",
    ])
  );
});

test("requests only the photo-library access needed for local account avatars", () => {
  const config = getConfig({ config: {} } as ConfigContext);

  expect(config.plugins).toContainEqual([
    "expo-image-picker",
    {
      photosPermission: "允许内界 CAVE 访问你选择的照片，以便更改仅保存在本机的账号头像。",
      cameraPermission: false,
      microphonePermission: false,
    },
  ]);
});

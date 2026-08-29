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

test("allows native light and dark appearance changes on both platforms", () => {
  const config = getConfig({ config: {} } as ConfigContext);

  expect(config.userInterfaceStyle).toBe("automatic");
  expect(config.plugins).toContain("expo-system-ui");
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

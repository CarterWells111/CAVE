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

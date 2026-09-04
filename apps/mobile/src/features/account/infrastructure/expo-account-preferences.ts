import * as ExpoSecureStore from "expo-secure-store";

import { createExpoSecureStoreAdapter } from "../../../core/storage/key-store";
import { AccountPreferencesService } from "../application/account-preferences-service";

const KEY = "account.preferences.v1";
export function createExpoAccountPreferencesService() {
  const store = createExpoSecureStoreAdapter(ExpoSecureStore as unknown as Parameters<typeof createExpoSecureStoreAdapter>[0]);
  return new AccountPreferencesService({
    get: () => store.getItemAsync(KEY),
    set: (value) => store.setItemAsync(KEY, value, { keychainAccessible: "AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY" }),
  });
}

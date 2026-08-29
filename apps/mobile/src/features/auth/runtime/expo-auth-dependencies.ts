import * as ExpoCrypto from "expo-crypto";
import * as ExpoSecureStore from "expo-secure-store";

import {
  createExpoSecureStoreAdapter,
  createSecretRepository,
} from "../../../core/storage/key-store";
import { createAuthApiClient } from "../infrastructure/auth-api-client";
import { createAuthSessionStore } from "../infrastructure/auth-session-store";
import type { AuthDependencies } from "./AuthProvider";

type ExpoSecureStoreModule = Parameters<typeof createExpoSecureStoreAdapter>[0];
const DEFAULT_AUTH_GATEWAY_URL = "https://api.neijiecave.com";

function createRequestId(randomBytes: (length: number) => Uint8Array): string {
  const bytes = randomBytes(16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createExpoAuthDependencies(
  options: {
    randomBytes?: (length: number) => Uint8Array;
    isDevelopment?: boolean;
  } = {},
): AuthDependencies {
  const randomBytes = options.randomBytes ?? ExpoCrypto.getRandomBytes;
  const configuredGatewayUrl = process.env.EXPO_PUBLIC_GATEWAY_URL?.trim();
  const gatewayUrl = configuredGatewayUrl || DEFAULT_AUTH_GATEWAY_URL;
  if (!(options.isDevelopment ?? __DEV__) && !/^https:\/\//iu.test(gatewayUrl)) {
    throw new Error("auth-api-https-required");
  }
  const secureStore = createExpoSecureStoreAdapter(
    ExpoSecureStore as unknown as ExpoSecureStoreModule,
  );
  const secrets = createSecretRepository({ secureStore, randomBytes });
  return {
    api: createAuthApiClient({
      baseUrl: gatewayUrl,
    }),
    sessionStore: createAuthSessionStore(secureStore),
    getInstallationToken: () => secrets.getOrCreateInstallationToken(),
    createRequestId: () => createRequestId(randomBytes),
    now: Date.now,
  };
}

import { createAuthApiClient } from "../infrastructure/auth-api-client";
import { createExpoAuthDependencies } from "./expo-auth-dependencies";

jest.mock("../infrastructure/auth-api-client", () => ({
  createAuthApiClient: jest.fn(() => ({})),
}));

const originalGatewayUrl = process.env.EXPO_PUBLIC_GATEWAY_URL;

afterEach(() => {
  jest.clearAllMocks();
  if (originalGatewayUrl === undefined) delete process.env.EXPO_PUBLIC_GATEWAY_URL;
  else process.env.EXPO_PUBLIC_GATEWAY_URL = originalGatewayUrl;
});

test("uses the deployed HTTPS Gateway when no development override is configured", () => {
  delete process.env.EXPO_PUBLIC_GATEWAY_URL;

  createExpoAuthDependencies();

  expect(createAuthApiClient).toHaveBeenCalledWith({
    baseUrl: "https://api.neijiecave.com",
  });
});

test("treats a blank Gateway environment value as missing configuration", () => {
  process.env.EXPO_PUBLIC_GATEWAY_URL = "   ";

  createExpoAuthDependencies();

  expect(createAuthApiClient).toHaveBeenCalledWith({
    baseUrl: "https://api.neijiecave.com",
  });
});

test("allows an explicit local Gateway override during development", () => {
  process.env.EXPO_PUBLIC_GATEWAY_URL = "http://localhost:8787";

  createExpoAuthDependencies({ isDevelopment: true } as Parameters<
    typeof createExpoAuthDependencies
  >[0] & { isDevelopment: boolean });

  expect(createAuthApiClient).toHaveBeenCalledWith({
    baseUrl: "http://localhost:8787",
  });
});

test("rejects a plaintext Gateway override outside development", () => {
  process.env.EXPO_PUBLIC_GATEWAY_URL = "http://gateway.example.com";

  expect(() => createExpoAuthDependencies({ isDevelopment: false } as Parameters<
    typeof createExpoAuthDependencies
  >[0] & { isDevelopment: boolean })).toThrow("auth-api-https-required");
  expect(createAuthApiClient).not.toHaveBeenCalled();
});

test("allows an explicit HTTPS Gateway override outside development", () => {
  process.env.EXPO_PUBLIC_GATEWAY_URL = "https://staging-api.neijiecave.com";

  createExpoAuthDependencies({ isDevelopment: false } as Parameters<
    typeof createExpoAuthDependencies
  >[0] & { isDevelopment: boolean });

  expect(createAuthApiClient).toHaveBeenCalledWith({
    baseUrl: "https://staging-api.neijiecave.com",
  });
});

test("uses Expo native randomness when the Expo Go runtime has no global Web Crypto", () => {
  const randomBytes = jest.fn((length: number) => (
    Uint8Array.from({ length }, (_, index) => index)
  ));
  const previous = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: undefined });
  try {
    const dependencies = createExpoAuthDependencies({ randomBytes });

    expect(dependencies.createRequestId()).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
    expect(randomBytes).toHaveBeenCalledWith(16);
  } finally {
    if (previous === undefined) delete (globalThis as { crypto?: Crypto }).crypto;
    else Object.defineProperty(globalThis, "crypto", previous);
  }
});

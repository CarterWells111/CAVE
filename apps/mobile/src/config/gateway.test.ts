import { getGatewayUrl, isAllowedGatewayUrl, isAssistantPreview, PRODUCTION_GATEWAY_URL, STAGING_GATEWAY_URL } from "./gateway";
const originalUrl = process.env.EXPO_PUBLIC_GATEWAY_URL;
const originalMode = process.env.EXPO_PUBLIC_ASSISTANT_MODE;
afterEach(() => {
  if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_GATEWAY_URL;
  else process.env.EXPO_PUBLIC_GATEWAY_URL = originalUrl;
  if (originalMode === undefined) delete process.env.EXPO_PUBLIC_ASSISTANT_MODE;
  else process.env.EXPO_PUBLIC_ASSISTANT_MODE = originalMode;
});
test.each([undefined, "", "   "])("development defaults to staging without a configured URL (%s)", value => {
  if (value === undefined) delete process.env.EXPO_PUBLIC_GATEWAY_URL;
  else process.env.EXPO_PUBLIC_GATEWAY_URL = value;
  expect(getGatewayUrl({ isDevelopment: true, environment: "development" })).toBe(STAGING_GATEWAY_URL);
});
test("Expo Go and development clients can use a LAN Gateway or HTTPS tunnel", () => {
  for (const value of ["http://192.168.1.23:8787", "http://10.1.2.3:8787", "https://local-gateway.example.com"]) {
    process.env.EXPO_PUBLIC_GATEWAY_URL = ` ${value} `;
    expect(getGatewayUrl({ isDevelopment: true, environment: "development" })).toBe(value);
  }
});
test.each(["http://localhost:8787", "http://127.0.0.1:8787", "http://8.8.8.8:8787", "http://192.168.1.23:8787/path", "ftp://192.168.1.23:8787"])(
  "rejects unusable development Gateway %s", value => {
    process.env.EXPO_PUBLIC_GATEWAY_URL = value;
    expect(() => getGatewayUrl({ isDevelopment: true, environment: "development" })).toThrow("gateway-url-invalid");
  },
);
test.each(["preview", "production"])("%s ignores any Gateway override, including staging and HTTP", environment => {
  for (const value of [STAGING_GATEWAY_URL, "http://192.168.1.23:8787"]) {
    process.env.EXPO_PUBLIC_GATEWAY_URL = value;
    expect(getGatewayUrl({ isDevelopment: false, environment })).toBe(PRODUCTION_GATEWAY_URL);
    expect(getGatewayUrl({ isDevelopment: true, environment })).toBe(PRODUCTION_GATEWAY_URL);
  }
});
test("non-development bundles default to production and development builds default to staging", () => {
  process.env.EXPO_PUBLIC_GATEWAY_URL = "http://192.168.1.23:8787";
  expect(getGatewayUrl({ isDevelopment: false, environment: "unknown" })).toBe(PRODUCTION_GATEWAY_URL);
  expect(getGatewayUrl({ isDevelopment: false, environment: "development" })).toBe(STAGING_GATEWAY_URL);
  expect(getGatewayUrl({ isDevelopment: false, environment: "acceptance" })).toBe(STAGING_GATEWAY_URL);
  expect(isAllowedGatewayUrl("http://192.168.1.23:8787", false)).toBe(false);
});
test("release bundle cannot switch to UI simulation even with stale mock environment", () => {
  process.env.EXPO_PUBLIC_ASSISTANT_MODE = "mock";
  expect(isAssistantPreview(false)).toBe(false);
  expect(isAssistantPreview(true)).toBe(true);
  process.env.EXPO_PUBLIC_ASSISTANT_MODE = "live";
  expect(isAssistantPreview(true)).toBe(false);
});

import { DEFAULT_GATEWAY_URL, getGatewayUrl, isAssistantPreview } from "./gateway";
const originalUrl = process.env.EXPO_PUBLIC_GATEWAY_URL;
const originalMode = process.env.EXPO_PUBLIC_ASSISTANT_MODE;
afterEach(() => {
  if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_GATEWAY_URL;
  else process.env.EXPO_PUBLIC_GATEWAY_URL = originalUrl;
  if (originalMode === undefined) delete process.env.EXPO_PUBLIC_ASSISTANT_MODE;
  else process.env.EXPO_PUBLIC_ASSISTANT_MODE = originalMode;
});
test.each([undefined, "", "   "])("clean checkout uses deployed gateway (%s)", value => {
  if (value === undefined) delete process.env.EXPO_PUBLIC_GATEWAY_URL;
  else process.env.EXPO_PUBLIC_GATEWAY_URL = value;
  expect(getGatewayUrl()).toBe(DEFAULT_GATEWAY_URL);
});
test("explicit gateway overrides are shared by auth and AI", () => {
  process.env.EXPO_PUBLIC_GATEWAY_URL = " https://staging.example.com ";
  expect(getGatewayUrl()).toBe("https://staging.example.com");
});
test("release bundle cannot switch to UI simulation even with stale mock environment", () => {
  process.env.EXPO_PUBLIC_ASSISTANT_MODE = "mock";
  expect(isAssistantPreview(false)).toBe(false);
  expect(isAssistantPreview(true)).toBe(true);
  process.env.EXPO_PUBLIC_ASSISTANT_MODE = "live";
  expect(isAssistantPreview(true)).toBe(false);
});

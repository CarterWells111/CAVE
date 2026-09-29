import Constants from "expo-constants";

// Public service configuration only. Provider credentials stay in the Worker.
export const PRODUCTION_GATEWAY_URL = "https://api.neijiecave.com";
export const STAGING_GATEWAY_URL = "https://staging-api.neijiecave.com";

type GatewayOptions = { isDevelopment?: boolean | undefined; environment?: unknown };

export function isAllowedGatewayUrl(value: string, isDevelopment: boolean): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return false;
    if (["localhost", "127.0.0.1", "[::1]", "0.0.0.0"].includes(url.hostname)) return false;
    if (url.protocol === "https:") return true;
    if (url.protocol !== "http:" || !isDevelopment) return false;
    const parts = url.hostname.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
    return parts[0] === 10
      || (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31)
      || (parts[0] === 192 && parts[1] === 168);
  } catch {
    return false;
  }
}

export function getGatewayUrl(options: GatewayOptions = {}): string {
  const isDevelopment = options.isDevelopment ?? __DEV__;
  const environment = options.environment ?? Constants.expoConfig?.extra?.environment;

  if (environment === "preview" || environment === "production") return PRODUCTION_GATEWAY_URL;
  if (!isDevelopment && environment !== "development" && environment !== "acceptance") {
    return PRODUCTION_GATEWAY_URL;
  }
  if (!isDevelopment) return STAGING_GATEWAY_URL;

  const configured = process.env.EXPO_PUBLIC_GATEWAY_URL?.trim();
  if (!configured) return STAGING_GATEWAY_URL;
  if (!isAllowedGatewayUrl(configured, isDevelopment)) throw new Error("gateway-url-invalid");
  return new URL(configured).origin;
}

export function isAssistantPreview(isDevelopment = __DEV__): boolean {
  return isDevelopment && process.env.EXPO_PUBLIC_ASSISTANT_MODE === "mock";
}

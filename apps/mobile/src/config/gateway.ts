// Public service configuration only. Provider credentials stay in the Worker.
export const DEFAULT_GATEWAY_URL = "https://api.neijiecave.com";

export function getGatewayUrl(): string {
  return process.env.EXPO_PUBLIC_GATEWAY_URL?.trim() || DEFAULT_GATEWAY_URL;
}

export function isAssistantPreview(isDevelopment = __DEV__): boolean {
  return isDevelopment && process.env.EXPO_PUBLIC_ASSISTANT_MODE === "mock";
}

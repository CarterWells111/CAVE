import { MobileAuthApiError } from "../infrastructure/auth-api-client";

const reauthenticationCodes = new Set([
  "AUTH_REAUTH_REQUIRED",
  "AUTH_SESSION_EXPIRED",
  "AUTH_UNAUTHORIZED",
]);

export function isAuthReauthenticationRequired(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && typeof error.code === "string"
    && reauthenticationCodes.has(error.code);
}

export function getAuthErrorMessage(error: unknown): string {
  if (!(error instanceof MobileAuthApiError)) {
    return "操作未完成。请检查网络、邮箱或验证码后重试。";
  }
  switch (error.code) {
    case "NETWORK_ERROR":
      return "无法连接认证服务。请检查网络连接后重试。";
    case "AUTH_DELIVERY_UNAVAILABLE":
      return "验证码暂时无法发送。请稍后重试。";
    case "RATE_LIMITED":
      return error.retryAfterSeconds === undefined
        ? "操作过于频繁。请稍后重试。"
        : `操作过于频繁。请等待 ${Math.max(1, Math.ceil(error.retryAfterSeconds))} 秒后重试。`;
    case "AUTH_INVALID_CODE":
      return "验证码不正确。请检查后重新输入。";
    case "AUTH_CODE_EXPIRED":
      return "验证码已过期。请重新获取验证码。";
    case "AUTH_TOO_MANY_ATTEMPTS":
      return "验证码尝试次数过多。请重新获取验证码。";
    case "AUTH_CHALLENGE_INVALID":
      return "本次验证已失效。请重新获取验证码。";
    case "AUTH_REAUTH_REQUIRED":
      return "删除验证已失效。请重新获取验证码。";
    case "AUTH_SESSION_EXPIRED":
      return "登录已过期。请重新登录后再试。";
    case "AUTH_UNAUTHORIZED":
      return "登录状态无效。请重新登录后再试。";
    case "INVALID_RESPONSE":
      return "认证服务返回异常。请稍后重试。";
    default:
      return "操作未完成。请检查网络、邮箱或验证码后重试。";
  }
}

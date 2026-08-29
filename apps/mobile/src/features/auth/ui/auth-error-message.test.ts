import { MobileAuthApiError } from "../infrastructure/auth-api-client";
import {
  getAuthErrorMessage,
  isAuthReauthenticationRequired,
} from "./auth-error-message";

test.each([
  ["AUTH_REAUTH_REQUIRED", "删除验证已失效。请重新获取验证码。"],
  ["AUTH_SESSION_EXPIRED", "登录已过期。请重新登录后再试。"],
  ["AUTH_UNAUTHORIZED", "登录状态无效。请重新登录后再试。"],
] as const)("maps %s to a recovery action", (code, message) => {
  const error = new MobileAuthApiError(code, 401);

  expect(isAuthReauthenticationRequired(error)).toBe(true);
  expect(getAuthErrorMessage(error)).toBe(message);
});

test("does not reset deletion verification for unrelated authentication errors", () => {
  expect(isAuthReauthenticationRequired(
    new MobileAuthApiError("AUTH_INVALID_CODE", 400),
  )).toBe(false);
});

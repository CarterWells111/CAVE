import type { ApiErrorCode, ApiErrorResponse } from "@cave/contracts";

import { InvalidModelOutputError } from "../providers/repair";
import { ProviderError } from "../providers/types";

export class GatewayError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly retryAfterSeconds?: number | undefined;

  constructor(
    code: ApiErrorCode,
    status: number,
    options: { retryAfterSeconds?: number } = {}
  ) {
    super(`Gateway request failed (${code})`);
    this.name = "GatewayError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

const MESSAGE_KEYS: Record<ApiErrorCode, string> = {
  INVALID_REQUEST: "gateway.invalid_request",
  CONTRACT_MISMATCH: "gateway.contract_mismatch",
  RATE_LIMITED: "gateway.rate_limited",
  MODEL_TIMEOUT: "gateway.model_timeout",
  MODEL_UNAVAILABLE: "gateway.model_unavailable",
  UNSAFE_CONTEXT: "gateway.unsafe_context",
  INVALID_MODEL_OUTPUT: "gateway.invalid_model_output",
  AUTH_INVALID_CODE: "auth.invalid_code",
  AUTH_CODE_EXPIRED: "auth.code_expired",
  AUTH_TOO_MANY_ATTEMPTS: "auth.too_many_attempts",
  AUTH_SESSION_EXPIRED: "auth.session_expired",
  AUTH_UNAUTHORIZED: "auth.unauthorized",
  AUTH_REAUTH_REQUIRED: "auth.reauth_required",
  AUTH_DELIVERY_UNAVAILABLE: "auth.delivery_unavailable",
  AUTH_CHALLENGE_INVALID: "auth.challenge_invalid",
  ACCOUNT_PREFERENCES_CONFLICT: "gateway.account_preferences_conflict",
  INTERNAL_ERROR: "gateway.internal_error"
};

export function requestIdFromUnknown(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "requestId" in value &&
    typeof value.requestId === "string" &&
    value.requestId.length > 0
  ) {
    return value.requestId;
  }
  return "unknown";
}

export function mapGatewayError(
  error: unknown,
  requestId: string
): { status: number; body: ApiErrorResponse } {
  let code: ApiErrorCode = "INTERNAL_ERROR";
  let status = 500;
  let retryAfterSeconds: number | undefined;

  if (error instanceof GatewayError) {
    code = error.code;
    status = error.status;
    retryAfterSeconds = error.retryAfterSeconds;
  } else if (error instanceof InvalidModelOutputError) {
    code = "INVALID_MODEL_OUTPUT";
    status = 502;
  } else if (error instanceof ProviderError) {
    if (error.code === "timeout") {
      code = "MODEL_TIMEOUT";
      status = 504;
    } else if (error.code === "rate_limited") {
      code = "RATE_LIMITED";
      status = 429;
      retryAfterSeconds = error.retryAfterSeconds;
    } else if (error.code === "invalid_response") {
      code = "INVALID_MODEL_OUTPUT";
      status = 502;
    } else {
      code = "MODEL_UNAVAILABLE";
      status = 503;
    }
  }

  return {
    status,
    body: {
      contractVersion: "1",
      requestId,
      code,
      messageKey: MESSAGE_KEYS[code],
      ...(retryAfterSeconds ? { retryAfterSeconds } : {})
    }
  };
}

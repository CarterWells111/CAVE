import { z } from "zod";

export const ApiErrorCodeSchema = z.enum([
  "INVALID_REQUEST",
  "CONTRACT_MISMATCH",
  "RATE_LIMITED",
  "MODEL_TIMEOUT",
  "MODEL_UNAVAILABLE",
  "UNSAFE_CONTEXT",
  "INVALID_MODEL_OUTPUT",
  "AUTH_INVALID_CODE",
  "AUTH_CODE_EXPIRED",
  "AUTH_TOO_MANY_ATTEMPTS",
  "AUTH_SESSION_EXPIRED",
  "AUTH_UNAUTHORIZED",
  "AUTH_REAUTH_REQUIRED",
  "AUTH_DELIVERY_UNAVAILABLE",
  "AUTH_CHALLENGE_INVALID",
  "INTERNAL_ERROR"
]);

export const ApiErrorResponseSchema = z
  .object({
    contractVersion: z.literal("1"),
    requestId: z.string().min(1),
    code: ApiErrorCodeSchema,
    messageKey: z.string().min(1),
    retryAfterSeconds: z.number().int().positive().optional()
  })
  .strict();

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

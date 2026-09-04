import type { ApiErrorCode, ApiErrorResponse } from "@cave/contracts";
import type { Context } from "hono";
import type { z } from "zod";
import { AuthServiceError } from "../auth/service";

const MAX_AUTH_REQUEST_BYTES = 16 * 1024;

export function errorBody(
  code: ApiErrorCode,
  requestId = "invalid-request",
  retryAfterSeconds?: number,
): ApiErrorResponse {
  const messageKey = code.startsWith("AUTH_")
    ? `auth.${code.slice("AUTH_".length).toLowerCase()}`
    : `gateway.${code.toLowerCase()}`;
  return {
    contractVersion: "1",
    requestId,
    code,
    messageKey,
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  };
}

export function requestIdFrom(value: unknown): string {
  return typeof value === "object" && value !== null && "requestId" in value
    && typeof value.requestId === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value.requestId)
    ? value.requestId
    : "invalid-request";
}

export async function boundedJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) throw new AuthServiceError("INVALID_REQUEST", 400);
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_AUTH_REQUEST_BYTES) {
    throw new AuthServiceError("INVALID_REQUEST", 413);
  }
  if (request.body === null) throw new AuthServiceError("INVALID_REQUEST", 400);
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let length = 0;
  let text = "";
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > MAX_AUTH_REQUEST_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new AuthServiceError("INVALID_REQUEST", 413);
      }
      text += decoder.decode(result.value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AuthServiceError("INVALID_REQUEST", 400);
  }
}

export function parse<Schema extends z.ZodType>(schema: Schema, value: unknown): z.infer<Schema> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AuthServiceError("INVALID_REQUEST", 400);
  return parsed.data;
}

export function statusOf(error: AuthServiceError): 400 | 401 | 409 | 413 | 429 | 500 | 503 {
  return [400, 401, 409, 413, 429, 500, 503].includes(error.status)
    ? error.status as 400 | 401 | 409 | 413 | 429 | 500 | 503
    : 500;
}

export function bearerAccessToken(context: Context): string {
  const authorization = context.req.header("authorization") ?? "";
  const match = /^Bearer (cave_at_[A-Za-z0-9_-]{43})$/u.exec(authorization);
  if (match?.[1] === undefined) throw new AuthServiceError("AUTH_UNAUTHORIZED", 401);
  return match[1];
}

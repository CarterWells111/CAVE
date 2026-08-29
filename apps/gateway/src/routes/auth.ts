import {
  AccountDeletionChallengeRequestSchema,
  AccountDeletionRequestSchema,
  EmailChallengeRequestSchema,
  EmailChallengeVerifyRequestSchema,
  LogoutSessionRequestSchema,
  RefreshSessionRequestSchema,
  type ApiErrorCode,
  type ApiErrorResponse,
} from "@cave/contracts";
import { Hono, type Context } from "hono";
import type { z } from "zod";

import { AuthServiceError, type AuthService } from "../auth/service";

const MAX_AUTH_REQUEST_BYTES = 16 * 1024;

type Dependencies = {
  service: Pick<
    AuthService,
    "requestEmailChallenge" | "verifyEmailChallenge" | "refresh" | "logout"
      | "requestAccountDeletionChallenge" | "verifyAccountDeletionChallenge" | "deleteAccount"
  >;
  logger?: ((line: string) => void) | undefined;
};

function errorBody(
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

function requestIdFrom(value: unknown): string {
  return typeof value === "object" && value !== null && "requestId" in value
    && typeof value.requestId === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value.requestId)
    ? value.requestId
    : "invalid-request";
}

async function boundedJson(request: Request): Promise<unknown> {
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

function parse<Schema extends z.ZodType>(schema: Schema, value: unknown): z.infer<Schema> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AuthServiceError("INVALID_REQUEST", 400);
  return parsed.data;
}

function statusOf(error: AuthServiceError): 400 | 401 | 413 | 429 | 500 | 503 {
  return [400, 401, 413, 429, 500, 503].includes(error.status)
    ? error.status as 400 | 401 | 413 | 429 | 500 | 503
    : 500;
}

function bearerAccessToken(context: Context): string {
  const authorization = context.req.header("authorization") ?? "";
  const match = /^Bearer (cave_at_[A-Za-z0-9_-]{43})$/u.exec(authorization);
  if (match?.[1] === undefined) throw new AuthServiceError("AUTH_UNAUTHORIZED", 401);
  return match[1];
}

export function createAuthRoutes({ service, logger = () => undefined }: Dependencies): Hono {
  const routes = new Hono();

  async function execute(
    context: Context,
    route: string,
    action: (body: unknown) => Promise<Response>,
  ): Promise<Response> {
    let body: unknown;
    const startedAt = Date.now();
    let status = 500;
    try {
      body = await boundedJson(context.req.raw);
      const response = await action(body);
      status = response.status;
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("Pragma", "no-cache");
      return response;
    } catch (error) {
      const typed = error instanceof AuthServiceError
        ? error
        : new AuthServiceError("INTERNAL_ERROR", 500);
      context.header("Cache-Control", "no-store");
      context.header("Pragma", "no-cache");
      if (typed.retryAfterSeconds !== undefined) {
        context.header("Retry-After", String(typed.retryAfterSeconds));
      }
      const responseStatus = statusOf(typed);
      status = responseStatus;
      return context.json(
        errorBody(typed.code, requestIdFrom(body), typed.retryAfterSeconds),
        responseStatus,
      );
    } finally {
      try {
        logger(JSON.stringify({
          requestId: requestIdFrom(body),
          route,
          status,
          latencyMs: Date.now() - startedAt,
        }));
      } catch {
        // Authentication logging is best-effort and never contains request bodies.
      }
    }
  }

  routes.post("/v1/auth/email/challenges", (context) => execute(context, "email_challenge", async (body) => {
    const result = await service.requestEmailChallenge(parse(EmailChallengeRequestSchema, body));
    return Response.json(result, { status: 202 });
  }));

  routes.post("/v1/auth/email/challenges/:challengeId/verify", (context) => execute(context, "email_verify", async (body) => {
    const result = await service.verifyEmailChallenge(
      context.req.param("challengeId"),
      parse(EmailChallengeVerifyRequestSchema, body),
    );
    return Response.json(result);
  }));

  routes.post("/v1/auth/sessions/refresh", (context) => execute(context, "session_refresh", async (body) => (
    Response.json(await service.refresh(parse(RefreshSessionRequestSchema, body)))
  )));

  routes.post("/v1/auth/sessions/logout", (context) => execute(context, "session_logout", async (body) => {
    await service.logout(parse(LogoutSessionRequestSchema, body));
    return new Response(null, { status: 204 });
  }));

  routes.post("/v1/auth/account/deletion/challenges", (context) => execute(context, "deletion_challenge", async (body) => {
    const result = await service.requestAccountDeletionChallenge(
      bearerAccessToken(context),
      parse(AccountDeletionChallengeRequestSchema, body),
    );
    return Response.json(result, { status: 202 });
  }));

  routes.post("/v1/auth/account/deletion/challenges/:challengeId/verify", (context) => execute(context, "deletion_verify", async (body) => {
    const result = await service.verifyAccountDeletionChallenge(
      context.req.param("challengeId"),
      parse(EmailChallengeVerifyRequestSchema, body),
    );
    return Response.json(result);
  }));

  routes.post("/v1/auth/account", (context) => execute(context, "account_delete", async (body) => {
    await service.deleteAccount(parse(AccountDeletionRequestSchema, body));
    return new Response(null, { status: 204 });
  }));

  return routes;
}

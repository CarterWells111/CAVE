import {
  AccountDeletionChallengeRequestSchema,
  AccountDeletionRequestSchema,
  EmailChallengeRequestSchema,
  EmailChallengeVerifyRequestSchema,
  LogoutSessionRequestSchema,
  RefreshSessionRequestSchema,
} from "@cave/contracts";
import { Hono, type Context } from "hono";

import { AuthServiceError, type AuthService } from "../auth/service";
import { bearerAccessToken, boundedJson, errorBody, parse, requestIdFrom, statusOf } from "./authenticated-http";

type Dependencies = {
  service: Pick<
    AuthService,
    "requestEmailChallenge" | "verifyEmailChallenge" | "refresh" | "logout"
      | "requestAccountDeletionChallenge" | "verifyAccountDeletionChallenge" | "deleteAccount"
  >;
  logger?: ((line: string) => void) | undefined;
};

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

import { AssistantRequestSchema } from "@cave/contracts";
import { Hono } from "hono";
import { digestOpaqueToken } from "../auth/crypto";
import type { AuthRepository } from "../auth/repository";
import { AuthServiceError } from "../auth/service";
import type { RateLimitStore } from "../security/rate-limit";
import { assistantFallback, type createAssistantService } from "../services/assistant";
import { bearerAccessToken, boundedJson, errorBody, parse, statusOf } from "./authenticated-http";

export function createAssistantRoutes(options: {
  repository?: Pick<AuthRepository, "findSessionByAccessDigest" | "findAccountById">;
  rateLimitStore: RateLimitStore;
  service: ReturnType<typeof createAssistantService>;
  providerMode: "mock" | "live";
}) {
  const app = new Hono();
  app.post("/v1/assistant", async context => {
    context.header("Cache-Control", "no-store");
    try {
      const accessToken = bearerAccessToken(context);
      if (!options.repository) return context.json(assistantFallback(options.providerMode), 503);
      const session = await options.repository.findSessionByAccessDigest(await digestOpaqueToken(accessToken));
      if (!session || session.revokedAt || !Number.isFinite(Date.parse(session.accessExpiresAt)) || Date.parse(session.accessExpiresAt) <= Date.now()
        || !await options.repository.findAccountById(session.accountId)) throw new AuthServiceError("AUTH_UNAUTHORIZED", 401);
      const limit = await options.rateLimitStore.consume(`assistant:${await digestOpaqueToken(session.accountId)}`, 5, 60000, Date.now());
      if (!limit.allowed) {
        context.header("Retry-After", "60");
        return context.json(errorBody("RATE_LIMITED", "assistant", 60), 429);
      }
      const input = parse(AssistantRequestSchema, await boundedJson(context.req.raw, 48 * 1024));
      return context.json(await options.service(input));
    } catch (error) {
      if (error instanceof AuthServiceError) return context.json(errorBody(error.code), statusOf(error));
      return context.json(assistantFallback(options.providerMode), 503);
    }
  });
  return app;
}

import { AssistantRequestSchema } from "@cave/contracts";
import { Hono } from "hono";
import { digestOpaqueToken } from "../auth/crypto";
import type { AuthRepository } from "../auth/repository";
import { AuthServiceError } from "../auth/service";
import type { RateLimitStore } from "../security/rate-limit";
import type { AssistantUsageStore } from "../services/assistant-usage";
import { assistantFallback, type createAssistantService } from "../services/assistant";
import { bearerAccessToken, boundedJson, errorBody, parse, statusOf } from "./authenticated-http";

export function createAssistantRoutes(options: {
  repository?: Pick<AuthRepository, "findSessionByAccessDigest" | "findAccountById">;
  rateLimitStore: RateLimitStore;
  usage?: AssistantUsageStore;
  service: ReturnType<typeof createAssistantService>;
  providerMode: "mock" | "live";
}) {
  const app = new Hono();
  const accountFor = async (accessToken: string) => {
    if (!options.repository) throw new Error("assistant-auth-unavailable");
    const session = await options.repository.findSessionByAccessDigest(await digestOpaqueToken(accessToken));
    if (!session || session.revokedAt || !Number.isFinite(Date.parse(session.accessExpiresAt)) || Date.parse(session.accessExpiresAt) <= Date.now()
      || !await options.repository.findAccountById(session.accountId)) throw new AuthServiceError("AUTH_UNAUTHORIZED", 401);
    return session.accountId;
  };
  app.get("/v1/assistant/usage", async context => {
    context.header("Cache-Control", "no-store");
    try {
      const accountId = await accountFor(bearerAccessToken(context));
      if (!options.usage) return context.json({ code: "USAGE_UNAVAILABLE" }, 503);
      return context.json(await options.usage.read(accountId, Date.now()));
    } catch (error) {
      if (error instanceof AuthServiceError) return context.json(errorBody(error.code), statusOf(error));
      return context.json({ code: "USAGE_UNAVAILABLE" }, 503);
    }
  });
  app.post("/v1/assistant", async context => {
    context.header("Cache-Control", "no-store");
    try {
      const accountId = await accountFor(bearerAccessToken(context));
      const input = parse(AssistantRequestSchema, await boundedJson(context.req.raw, 48 * 1024));
      const now = Date.now();
      const limit = await options.rateLimitStore.consume(`assistant:${await digestOpaqueToken(accountId)}`, 5, 60000, now);
      if (!limit.allowed) {
        context.header("Retry-After", "60");
        return context.json(errorBody("RATE_LIMITED", "assistant", 60), 429);
      }
      if (options.providerMode === "live" && options.usage && !await options.usage.consume(accountId, now)) {
        const usage = await options.usage.read(accountId, now);
        const exhausted = [usage.hour, usage.day].filter(window => window.limit !== null && window.used >= window.limit);
        context.header("Retry-After", String(Math.max(1, ...exhausted.map(window => Math.ceil((Date.parse(window.resetsAt) - now) / 1000)))));
        return context.json({ code: "AI_QUOTA_EXCEEDED", usage }, 429);
      }
      return context.json(await options.service(input));
    } catch (error) {
      if (error instanceof AuthServiceError) return context.json(errorBody(error.code), statusOf(error));
      return context.json(assistantFallback(options.providerMode), 503);
    }
  });
  return app;
}

import { UpdateAccountPreferencesRequestSchema } from "@cave/contracts";
import { Hono, type Context } from "hono";
import { z } from "zod";
import type { AccountPreferencesService } from "../account-preferences/service";
import { AuthServiceError } from "../auth/service";
import { bearerAccessToken, boundedJson, errorBody, parse, requestIdFrom, statusOf } from "./authenticated-http";

const GetQuerySchema = z.object({ requestId: z.string().uuid() }).strict();

export function createAccountPreferencesRoutes({ service, logger = () => undefined }: {
  service: AccountPreferencesService;
  logger?: (line: string) => void;
}): Hono {
  const routes = new Hono();
  async function execute(context: Context, method: "get" | "update"): Promise<Response> {
    let input: unknown;
    let status = 500;
    const startedAt = Date.now();
    context.header("Cache-Control", "no-store");
    context.header("Pragma", "no-cache");
    try {
      input = method === "get" ? context.req.query() : await boundedJson(context.req.raw);
      const result = method === "get"
        ? await service.get(bearerAccessToken(context), parse(GetQuerySchema, input).requestId)
        : await service.update(bearerAccessToken(context), parse(UpdateAccountPreferencesRequestSchema, input));
      status = 200;
      return context.json(result);
    } catch (error) {
      const typed = error instanceof AuthServiceError ? error : new AuthServiceError("INTERNAL_ERROR", 500);
      const responseStatus = statusOf(typed);
      status = responseStatus;
      return context.json(errorBody(typed.code, requestIdFrom(input)), responseStatus);
    } finally {
      try {
        logger(JSON.stringify({ requestId: requestIdFrom(input), route: `account_preferences_${method}`, status, latencyMs: Date.now() - startedAt }));
      } catch {
        // Logs contain metadata only and must never alter the request outcome.
      }
    }
  }
  routes.get("/v1/account/preferences", (context) => execute(context, "get"));
  routes.patch("/v1/account/preferences", (context) => execute(context, "update"));
  return routes;
}

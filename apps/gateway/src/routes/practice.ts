import { Hono } from "hono";

import {
  GatewayError,
  mapGatewayError,
  requestIdFromUnknown
} from "../errors/map-error";
import type { DebriefService } from "../services/debrief";
import type { TurnService } from "../services/turn";

type PracticeRouteDependencies = {
  turnService: TurnService;
  debriefService: DebriefService;
};

type ErrorStatus = 400 | 429 | 500 | 502 | 503 | 504;

async function jsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new GatewayError("INVALID_REQUEST", 400);
  }
}

export function createPracticeRoutes(
  dependencies: PracticeRouteDependencies
): Hono {
  const routes = new Hono();

  routes.post("/v1/practice/turn", async (context) => {
    let body: unknown;
    try {
      body = await jsonBody(context.req.raw);
      const response = await dependencies.turnService.execute(
        body,
        context.req.raw.signal
      );
      context.header("Cache-Control", "no-store");
      return context.json(response);
    } catch (error) {
      const mapped = mapGatewayError(error, requestIdFromUnknown(body));
      context.header("Cache-Control", "no-store");
      return context.json(mapped.body, mapped.status as ErrorStatus);
    }
  });

  routes.post("/v1/practice/debrief", async (context) => {
    let body: unknown;
    try {
      body = await jsonBody(context.req.raw);
      const response = await dependencies.debriefService.execute(
        body,
        context.req.raw.signal
      );
      context.header("Cache-Control", "no-store");
      return context.json(response);
    } catch (error) {
      const mapped = mapGatewayError(error, requestIdFromUnknown(body));
      context.header("Cache-Control", "no-store");
      return context.json(mapped.body, mapped.status as ErrorStatus);
    }
  });

  return routes;
}

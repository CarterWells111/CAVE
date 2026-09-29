import {
  CompleteRoomAnswersRequestSchema, CreateRoomRequestSchema, JoinRoomRequestSchema,
  RoomActionRequestSchema, SaveRoomAnswersRequestSchema,
} from "@cave/contracts";
import { Hono, type Context } from "hono";
import { z } from "zod";
import { AuthServiceError } from "../auth/service";
import type { RoomService } from "../rooms/service";
import { bearerAccessToken, boundedJson, errorBody, parse, requestIdFrom, statusOf } from "./authenticated-http";

const Query = z.object({ requestId: z.string().uuid() }).strict();
const Id = z.string().uuid();

export function createRoomRoutes({ service, logger = () => undefined }: { service: RoomService; logger?: (line: string) => void }): Hono {
  const app = new Hono();
  async function execute(context: Context, name: string, read: boolean, action: (input: unknown, id: string) => Promise<Response>): Promise<Response> {
    let input: unknown;
    let status = 500;
    const start = Date.now();
    context.header("Cache-Control", "no-store");
    context.header("Pragma", "no-cache");
    try {
      const id = ["create", "join", "list"].includes(name) ? "" : parse(Id, context.req.param("roomId"));
      input = read ? context.req.query() : await boundedJson(context.req.raw, 16 * 1024);
      const result = await action(input, id);
      status = result.status;
      return result;
    } catch (error) {
      const typed = error instanceof AuthServiceError ? error : new AuthServiceError("INTERNAL_ERROR", 500);
      const responseStatus = statusOf(typed);
      status = responseStatus;
      return context.json(errorBody(typed.code, requestIdFrom(input)), responseStatus);
    } finally {
      try { logger(JSON.stringify({ route: `room_${name}`, status, latencyMs: Date.now() - start })); }
      catch { /* Never log answers, tokens, emails or reports. */ }
    }
  }
  app.post("/v1/rooms", context => execute(context, "create", false, async body => Response.json(
    await service.create(bearerAccessToken(context), parse(CreateRoomRequestSchema, body)), { status: 201 },
  )));
  app.post("/v1/rooms/join", context => execute(context, "join", false, async body => Response.json(
    await service.join(bearerAccessToken(context), parse(JoinRoomRequestSchema, body)),
  )));
  app.get("/v1/rooms", context => execute(context, "list", true, async query => Response.json(
    await service.list(bearerAccessToken(context), parse(Query, query).requestId),
  )));
  app.post("/v1/rooms/:roomId/invitation", context => execute(context, "invitation", false, async (body, id) => Response.json(
    await service.reissueInvitation(bearerAccessToken(context), id, parse(RoomActionRequestSchema, body).requestId),
  )));
  app.get("/v1/rooms/:roomId", context => execute(context, "get", true, async (query, id) => Response.json(
    await service.get(bearerAccessToken(context), id, parse(Query, query).requestId),
  )));
  app.put("/v1/rooms/:roomId/answers", context => execute(context, "save", false, async (body, id) => Response.json(
    await service.save(bearerAccessToken(context), id, parse(SaveRoomAnswersRequestSchema, body)),
  )));
  app.post("/v1/rooms/:roomId/complete", context => execute(context, "complete", false, async (body, id) => Response.json(
    await service.complete(bearerAccessToken(context), id, parse(CompleteRoomAnswersRequestSchema, body)),
  )));
  app.post("/v1/rooms/:roomId/report", context => execute(context, "report", false, async (body, id) => Response.json(
    await service.report(bearerAccessToken(context), id, parse(RoomActionRequestSchema, body).requestId),
  )));
  app.get("/v1/rooms/:roomId/report", context => execute(context, "read_report", true, async (query, id) => Response.json(
    await service.readReport(bearerAccessToken(context), id, parse(Query, query).requestId),
  )));
  app.delete("/v1/rooms/:roomId", context => execute(context, "terminate", false, async (body, id) => {
    parse(RoomActionRequestSchema, body);
    await service.terminate(bearerAccessToken(context), id);
    return new Response(null, { status: 204 });
  }));
  return app;
}

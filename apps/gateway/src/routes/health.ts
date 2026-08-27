import { Hono } from "hono";

export function createHealthRoutes(): Hono {
  const routes = new Hono();
  routes.get("/health", (context) => {
    context.header("Cache-Control", "no-store");
    return context.json({ contractVersion: "1" as const, status: "ok" as const });
  });
  return routes;
}

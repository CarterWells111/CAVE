import { Hono } from "hono";

const app = new Hono();

app.get("/health", (context) =>
  context.json({
    contractVersion: "1",
    status: "ok"
  })
);

export default app;

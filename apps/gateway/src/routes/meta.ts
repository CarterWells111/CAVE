import { Hono } from "hono";

import type { GatewayEnv } from "../env";
import { MOCK_MODEL_NAME } from "../prompts/versions";

export function createMetaRoutes(env: GatewayEnv): Hono {
  const routes = new Hono();
  routes.get("/v1/meta", (context) => {
    context.header("Cache-Control", "no-store");
    return context.json({
      contractVersion: "1" as const,
      promptVersion: env.PROMPT_VERSION,
      policyVersion: env.POLICY_VERSION,
      providerMode: env.MODEL_MODE,
      modelName: env.MODEL_MODE === "live" ? env.MODEL_NAME : MOCK_MODEL_NAME
    });
  });
  return routes;
}

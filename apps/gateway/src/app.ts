import { loadCatalog } from "@cave/content";
import type { ScenarioConfig } from "@cave/contracts";
import { Hono, type MiddlewareHandler } from "hono";

import { parseGatewayEnv, type GatewayEnv } from "./env";
import { D1AuthRepository } from "./auth/d1-auth-repository";
import { D1AccountPreferencesRepository } from "./account-preferences/repository";
import { createAccountPreferencesService, type AccountPreferencesService } from "./account-preferences/service";
import { createResendAuthEmailSender } from "./auth/resend-email-sender";
import { AuthServiceError, createAuthService, type AuthService } from "./auth/service";
import { safeLogEvent } from "./observability/safe-log";
import { buildSystemPrompt } from "./prompts/system";
import { MockProvider } from "./providers/mock";
import { OpenAICompatibleProvider } from "./providers/openai-compatible";
import type { JsonRepairer } from "./providers/repair";
import type { ModelProvider } from "./providers/types";
import { createHealthRoutes } from "./routes/health";
import { createMetaRoutes } from "./routes/meta";
import { createPracticeRoutes } from "./routes/practice";
import { createAuthRoutes } from "./routes/auth";
import { createAccountPreferencesRoutes } from "./routes/account-preferences";
import { createOutputGuard } from "./security/output-guard";
import {
  createRateLimiter,
  type RateLimitStore
} from "./security/rate-limit";
import {
  guardPracticeRequest,
  type PracticeRoute
} from "./security/request-guard";
import { createTurnSafetyEvaluator } from "./security/safety-policy";
import { createDebriefService } from "./services/debrief";
import {
  createTurnService,
  type ScenarioSource
} from "./services/turn";

export type WorkerBindings = Omit<
  Env,
  "MODEL_MODE" | "PROMPT_VERSION" | "POLICY_VERSION"
> & {
  MODEL_MODE: string;
  PROMPT_VERSION: string;
  POLICY_VERSION: string;
  MODEL_BASE_URL?: string;
  MODEL_API_KEY?: string;
  MODEL_NAME?: string;
  AUTH_DB?: D1Database;
  RESEND_API_KEY?: string;
  AUTH_EMAIL_LOOKUP_KEY_V1?: string;
  AUTH_EMAIL_LOOKUP_KEY_V2?: string;
  AUTH_OTP_KEY_V1?: string;
  AUTH_OTP_KEY_V2?: string;
};

export type GatewayAppOptions = {
  provider?: ModelProvider | undefined;
  scenarioSource?: ScenarioSource | undefined;
  rateLimitStore?: RateLimitStore | undefined;
  fetch?: typeof fetch | undefined;
  logger?: ((line: string) => void) | undefined;
  authService?: AuthService | undefined;
};

function unavailableAuthService(): AuthService {
  const unavailable = async (): Promise<never> => {
    throw new AuthServiceError("AUTH_DELIVERY_UNAVAILABLE", 503);
  };
  return {
    requestEmailChallenge: unavailable,
    verifyEmailChallenge: unavailable,
    refresh: unavailable,
    logout: unavailable,
    requestAccountDeletionChallenge: unavailable,
    verifyAccountDeletionChallenge: unavailable,
    deleteAccount: unavailable,
  } as AuthService;
}

function createBoundAuthService(rawEnv: unknown, options: GatewayAppOptions): AuthService {
  if (options.authService !== undefined) return options.authService;
  const bindings = rawEnv as Partial<WorkerBindings>;
  if (
    bindings.AUTH_DB === undefined
    || typeof bindings.RESEND_API_KEY !== "string"
    || typeof bindings.AUTH_EMAIL_LOOKUP_KEY_V1 !== "string"
    || typeof bindings.AUTH_OTP_KEY_V1 !== "string"
  ) return unavailableAuthService();
  return createAuthService({
    repository: new D1AuthRepository(bindings.AUTH_DB),
    emailSender: createResendAuthEmailSender({
      apiKey: bindings.RESEND_API_KEY,
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    }),
    emailLookupKeys: [
      ...(typeof bindings.AUTH_EMAIL_LOOKUP_KEY_V2 === "string"
        ? [{ version: 2, value: bindings.AUTH_EMAIL_LOOKUP_KEY_V2 }]
        : []),
      { version: 1, value: bindings.AUTH_EMAIL_LOOKUP_KEY_V1 },
    ],
    otpKeys: [
      ...(typeof bindings.AUTH_OTP_KEY_V2 === "string"
        ? [{ version: 2, value: bindings.AUTH_OTP_KEY_V2 }]
        : []),
      { version: 1, value: bindings.AUTH_OTP_KEY_V1 },
    ],
  });
}

function createBoundAccountPreferencesService(rawEnv: unknown): AccountPreferencesService {
  const bindings = rawEnv as Partial<WorkerBindings>;
  if (bindings.AUTH_DB === undefined) {
    const unavailable = async (): Promise<never> => { throw new AuthServiceError("AUTH_DELIVERY_UNAVAILABLE", 503); };
    return { get: unavailable, update: unavailable };
  }
  return createAccountPreferencesService({
    authRepository: new D1AuthRepository(bindings.AUTH_DB),
    repository: new D1AccountPreferencesRepository(bindings.AUTH_DB),
  });
}

function catalogScenarioSource(scenarios: readonly ScenarioConfig[]): ScenarioSource {
  const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  return {
    getScenario(id) {
      const scenario = byId.get(id);
      return scenario ? structuredClone(scenario) : undefined;
    }
  };
}

function jsonRepairer(provider: ModelProvider): JsonRepairer | undefined {
  if (
    "repairJson" in provider &&
    typeof (provider as { repairJson?: unknown }).repairJson === "function"
  ) {
    return provider as ModelProvider & JsonRepairer;
  }
  return undefined;
}

function createProvider(
  env: GatewayEnv,
  options: GatewayAppOptions
): ModelProvider {
  if (options.provider) return options.provider;
  if (env.MODEL_MODE === "mock") return new MockProvider();
  return new OpenAICompatibleProvider({
    baseUrl: env.MODEL_BASE_URL,
    apiKey: env.MODEL_API_KEY,
    modelName: env.MODEL_NAME,
    ...(options.fetch ? { fetch: options.fetch } : {})
  });
}

export function createWorkerRateLimitStore(
  bindings: Pick<WorkerBindings, "TURN_RATE_LIMITER" | "DEBRIEF_RATE_LIMITER">
): RateLimitStore {
  const turn = bindings.TURN_RATE_LIMITER;
  const debrief = bindings.DEBRIEF_RATE_LIMITER;
  if (!turn || !debrief) {
    throw new Error("Worker rate-limit bindings are required");
  }
  return {
    async consume(key) {
      const binding = key.startsWith("turn:") ? turn : debrief;
      const outcome = await binding.limit({ key });
      return outcome.success
        ? { allowed: true }
        : { allowed: false, retryAfterSeconds: 60 };
    }
  };
}

function requestMiddleware(
  route: PracticeRoute,
  knownScenarioIds: ReadonlySet<string>,
  rateLimitStore: RateLimitStore,
  env: GatewayEnv,
  logger: (line: string) => void
): MiddlewareHandler {
  const limiter = createRateLimiter({ store: rateLimitStore });
  return async (context, next) => {
    const startedAt = Date.now();
    let requestId = "invalid-request-id";
    let status = 500;
    try {
      const guarded = await guardPracticeRequest(
        context.req.raw.clone(),
        route,
        knownScenarioIds
      );
      if (!guarded.ok) {
        status = guarded.status;
        context.header("Cache-Control", "no-store");
        return context.json(guarded.error, guarded.status);
      }
      requestId = guarded.value.requestId;
      const rateLimit = await limiter.check(
        route,
        guarded.value.installationToken,
        requestId
      );
      if (!rateLimit.allowed) {
        status = rateLimit.status;
        context.header("Cache-Control", "no-store");
        context.header(
          "Retry-After",
          String(rateLimit.error.retryAfterSeconds)
        );
        return context.json(rateLimit.error, rateLimit.status);
      }
      await next();
      status = context.res.status;
    } finally {
      try {
        logger(
          safeLogEvent({
            requestId,
            route,
            status,
            latencyMs: Date.now() - startedAt,
            providerMode: env.MODEL_MODE,
            promptVersion: env.PROMPT_VERSION,
            policyVersion: env.POLICY_VERSION
          })
        );
      } catch {
        // Observability is best-effort and must never alter a request outcome.
      }
    }
  };
}

export function createApp(
  rawEnv: unknown,
  options: GatewayAppOptions = {}
): Hono {
  const env = parseGatewayEnv(rawEnv);
  const catalog = loadCatalog();
  const scenarioSource =
    options.scenarioSource ?? catalogScenarioSource(catalog.scenarios);
  const knownScenarioIds = new Set(catalog.scenarios.map(({ id }) => id));
  const provider = createProvider(env, options);
  const repairer = jsonRepairer(provider);
  const rateLimitStore =
    options.rateLimitStore ??
    createWorkerRateLimitStore(rawEnv as WorkerBindings);
  const logger = options.logger ?? (() => undefined);
  const authService = createBoundAuthService(rawEnv, options);
  const versions = {
    promptVersion: env.PROMPT_VERSION,
    policyVersion: env.POLICY_VERSION
  };
  const outputGuard = createOutputGuard({
    serverOwnedText: [
      buildSystemPrompt(env.PROMPT_VERSION, env.POLICY_VERSION)
    ]
  });
  const turnService = createTurnService({
    provider,
    ...(repairer ? { repairer } : {}),
    scenarioSource,
    safety: createTurnSafetyEvaluator(),
    outputGuard,
    ...versions
  });
  const debriefService = createDebriefService({
    provider,
    ...(repairer ? { repairer } : {}),
    scenarioSource,
    outputGuard,
    ...versions
  });

  const app = new Hono();
  app.use(
    "/v1/practice/turn",
    requestMiddleware("turn", knownScenarioIds, rateLimitStore, env, logger)
  );
  app.use(
    "/v1/practice/debrief",
    requestMiddleware("debrief", knownScenarioIds, rateLimitStore, env, logger)
  );
  app.route("/", createHealthRoutes());
  app.route("/", createMetaRoutes(env));
  app.route("/", createAuthRoutes({ service: authService, logger }));
  app.route("/", createAccountPreferencesRoutes({ service: createBoundAccountPreferencesService(rawEnv), logger }));
  app.route(
    "/",
    createPracticeRoutes({ turnService, debriefService })
  );
  return app;
}

export const createGatewayApp = createApp;

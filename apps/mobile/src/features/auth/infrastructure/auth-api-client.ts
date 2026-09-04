import {
  AccountPreferencesResponseSchema,
  type UpdateAccountPreferencesRequest,
  AccountDeletionGrantResponseSchema,
  AuthSessionResponseSchema,
  EmailChallengeAcceptedSchema,
  ApiErrorResponseSchema,
  type AccountDeletionChallengeRequest,
  type AccountDeletionRequest,
  type AuthSessionResponse,
  type EmailChallengeAccepted,
  type EmailChallengeRequest,
  type EmailChallengeVerifyRequest,
  type LogoutSessionRequest,
  type RefreshSessionRequest,
} from "@cave/contracts";
import type { z } from "zod";

type ClientDependencies = { baseUrl: string; fetch?: typeof globalThis.fetch };

export class MobileAuthApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly retryAfterSeconds?: number,
  ) {
    super("Authentication request failed");
    this.name = "MobileAuthApiError";
  }
}

export function createAuthApiClient({ baseUrl, fetch = globalThis.fetch }: ClientDependencies) {
  const origin = baseUrl.replace(/\/+$/u, "");
  if (!/^https?:\/\//u.test(origin)) throw new Error("auth-api-base-url-required");

  async function post<T>(
    path: string,
    body: unknown,
    schema: z.ZodType<T> | null,
    accessToken?: string,
    method: "GET" | "POST" | "PATCH" = "POST",
  ): Promise<T> {
    let response: Response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      response = await fetch(`${origin}${path}`, {
        method,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken === undefined ? {} : { Authorization: `Bearer ${accessToken}` }),
        },
        ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
    } catch {
      throw new MobileAuthApiError("NETWORK_ERROR", 0);
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      let decoded: unknown;
      try { decoded = await response.json(); } catch { decoded = undefined; }
      const error = ApiErrorResponseSchema.safeParse(decoded);
      throw new MobileAuthApiError(
        error.success ? error.data.code : "INVALID_RESPONSE",
        response.status,
        error.success ? error.data.retryAfterSeconds : undefined,
      );
    }
    if (schema === null) return undefined as T;
    let decoded: unknown;
    try { decoded = await response.json(); } catch { throw new MobileAuthApiError("INVALID_RESPONSE", response.status); }
    const parsed = schema.safeParse(decoded);
    if (!parsed.success) throw new MobileAuthApiError("INVALID_RESPONSE", response.status);
    return parsed.data;
  }

  return {
    getAccountPreferences: (accessToken: string, requestId: string) => post(
      `/v1/account/preferences?requestId=${encodeURIComponent(requestId)}`, undefined, AccountPreferencesResponseSchema, accessToken, "GET",
    ),
    updateAccountPreferences: (accessToken: string, input: UpdateAccountPreferencesRequest) => post(
      "/v1/account/preferences", input, AccountPreferencesResponseSchema, accessToken, "PATCH",
    ),
    requestEmailChallenge: (input: EmailChallengeRequest): Promise<EmailChallengeAccepted> => (
      post("/v1/auth/email/challenges", input, EmailChallengeAcceptedSchema)
    ),
    verifyEmailChallenge: (challengeId: string, input: EmailChallengeVerifyRequest): Promise<AuthSessionResponse> => (
      post(`/v1/auth/email/challenges/${encodeURIComponent(challengeId)}/verify`, input, AuthSessionResponseSchema)
    ),
    refresh: (input: RefreshSessionRequest): Promise<AuthSessionResponse> => (
      post("/v1/auth/sessions/refresh", input, AuthSessionResponseSchema)
    ),
    logout: (input: LogoutSessionRequest): Promise<void> => (
      post("/v1/auth/sessions/logout", input, null)
    ),
    requestAccountDeletionChallenge: (
      accessToken: string,
      input: AccountDeletionChallengeRequest,
    ): Promise<EmailChallengeAccepted> => post(
      "/v1/auth/account/deletion/challenges", input, EmailChallengeAcceptedSchema, accessToken,
    ),
    verifyAccountDeletionChallenge: (challengeId: string, input: EmailChallengeVerifyRequest) => (
      post(
        `/v1/auth/account/deletion/challenges/${encodeURIComponent(challengeId)}/verify`,
        input,
        AccountDeletionGrantResponseSchema,
      )
    ),
    deleteAccount: (input: AccountDeletionRequest): Promise<void> => (
      post("/v1/auth/account", input, null)
    ),
  };
}

export type AuthApiClient = ReturnType<typeof createAuthApiClient>;

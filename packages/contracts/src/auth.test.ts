import { describe, expect, it } from "vitest";

import {
  AccountDeletionChallengeRequestSchema,
  AccountDeletionGrantResponseSchema,
  AccountDeletionRequestSchema,
  AuthSessionResponseSchema,
  EmailChallengeAcceptedSchema,
  EmailChallengeRequestSchema,
  EmailChallengeVerifyRequestSchema,
  LogoutSessionRequestSchema,
  RefreshSessionRequestSchema,
} from "./auth";
import { ApiErrorCodeSchema } from "./errors";

const requestId = "7cbbc0f9-9d12-4b08-9741-75bbb399e7c6";
const challengeId = "cb02004c-7b5b-4680-9b16-8a6a33511bc9";
const accountId = "4414e7b4-bef7-4583-82ab-9795cf136871";
const accessToken = `cave_at_${"a".repeat(43)}`;
const refreshToken = `cave_rt_${"b".repeat(43)}`;

describe("email authentication contracts", () => {
  it("accepts a bounded email challenge request and rejects unknown fields", () => {
    const value = {
      contractVersion: "1",
      requestId,
      email: " Person@Example.com ",
      installationToken: "installation-token",
    };
    expect(EmailChallengeRequestSchema.parse(value).email).toBe("Person@Example.com");
    expect(() => EmailChallengeRequestSchema.parse({ ...value, journal: "private" })).toThrow();
    expect(() => EmailChallengeRequestSchema.parse({ ...value, email: `${"a".repeat(250)}@x.test` })).toThrow();
  });

  it("publishes a generic accepted challenge without account-existence fields", () => {
    const parsed = EmailChallengeAcceptedSchema.parse({
      contractVersion: "1",
      requestId,
      challengeId,
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
    expect(parsed).not.toHaveProperty("accountExists");
    expect(parsed).not.toHaveProperty("registered");
  });

  it("requires exactly six digits and the originating installation token", () => {
    const value = {
      contractVersion: "1",
      requestId,
      code: "012345",
      installationToken: "installation-token",
    };
    expect(EmailChallengeVerifyRequestSchema.parse(value).code).toBe("012345");
    expect(() => EmailChallengeVerifyRequestSchema.parse({ ...value, code: "12345" })).toThrow();
    expect(() => EmailChallengeVerifyRequestSchema.parse({ ...value, code: "12345a" })).toThrow();
  });

  it("keeps opaque access and refresh tokens type-separated", () => {
    const response = {
      contractVersion: "1",
      requestId,
      account: { id: accountId },
      session: {
        accessToken,
        accessExpiresAt: "2026-08-28T18:00:00.000Z",
        refreshToken,
        refreshExpiresAt: "2026-09-27T17:45:00.000Z",
      },
    };
    expect(AuthSessionResponseSchema.parse(response)).toEqual(response);
    expect(() => AuthSessionResponseSchema.parse({
      ...response,
      session: { ...response.session, accessToken: refreshToken },
    })).toThrow();
  });

  it("defines strict refresh and logout requests", () => {
    const value = { contractVersion: "1", requestId, refreshToken };
    expect(RefreshSessionRequestSchema.parse(value)).toEqual(value);
    expect(LogoutSessionRequestSchema.parse(value)).toEqual(value);
    expect(() => RefreshSessionRequestSchema.parse({ ...value, accessToken })).toThrow();
  });
});

describe("account deletion contracts", () => {
  it("requires the signed-in user to repeat their email", () => {
    const value = {
      contractVersion: "1",
      requestId,
      email: "person@example.com",
      installationToken: "installation-token",
    };
    expect(AccountDeletionChallengeRequestSchema.parse(value)).toEqual(value);
  });

  it("uses a short-lived deletion grant and an idempotency key", () => {
    const deletionGrant = `cave_dg_${"c".repeat(43)}`;
    expect(AccountDeletionGrantResponseSchema.parse({
      contractVersion: "1",
      requestId,
      deletionGrant,
      expiresInSeconds: 300,
    }).deletionGrant).toBe(deletionGrant);

    expect(AccountDeletionRequestSchema.parse({
      contractVersion: "1",
      requestId,
      deletionGrant,
      idempotencyKey: "delete-account/one",
    }).idempotencyKey).toBe("delete-account/one");
  });
});

it("publishes authentication failures without account-enumeration codes", () => {
  for (const code of [
    "AUTH_INVALID_CODE",
    "AUTH_CODE_EXPIRED",
    "AUTH_TOO_MANY_ATTEMPTS",
    "AUTH_SESSION_EXPIRED",
    "AUTH_UNAUTHORIZED",
    "AUTH_REAUTH_REQUIRED",
    "AUTH_DELIVERY_UNAVAILABLE",
    "AUTH_CHALLENGE_INVALID",
  ]) {
    expect(ApiErrorCodeSchema.parse(code)).toBe(code);
  }
  expect(() => ApiErrorCodeSchema.parse("ACCOUNT_NOT_FOUND")).toThrow();
});

import { createAuthApiClient, MobileAuthApiError } from "./auth-api-client";

const requestId = "7cbbc0f9-9d12-4b08-9741-75bbb399e7c6";
const challengeId = "cb02004c-7b5b-4680-9b16-8a6a33511bc9";

test("posts a no-store challenge request and validates the response contract", async () => {
  const fetch = jest.fn(async () => Response.json({
    contractVersion: "1", requestId, challengeId, expiresInSeconds: 600, resendAfterSeconds: 60,
  }, { status: 202 }));
  const client = createAuthApiClient({ baseUrl: "https://gateway.example/", fetch });
  await expect(client.requestEmailChallenge({
    contractVersion: "1", requestId, email: "person@example.com", installationToken: "installation-token-at-least-sixteen",
  })).resolves.toMatchObject({ challengeId });
  expect(fetch).toHaveBeenCalledWith("https://gateway.example/v1/auth/email/challenges", expect.objectContaining({
    method: "POST", cache: "no-store",
  }));
});

test("maps structured errors without leaking response bodies", async () => {
  const fetch = jest.fn(async () => Response.json({
    contractVersion: "1", requestId, code: "RATE_LIMITED", messageKey: "auth.rate_limited", retryAfterSeconds: 42,
  }, { status: 429 }));
  const client = createAuthApiClient({ baseUrl: "https://gateway.example", fetch });
  await expect(client.requestEmailChallenge({
    contractVersion: "1", requestId, email: "person@example.com", installationToken: "installation-token-at-least-sixteen",
  })).rejects.toEqual(expect.objectContaining({
    name: "MobileAuthApiError", code: "RATE_LIMITED", status: 429, retryAfterSeconds: 42,
  } satisfies Partial<MobileAuthApiError>));
});

test("classifies offline failures and never retries an OTP submission", async () => {
  const fetch = jest.fn(async () => { throw new Error("private network detail"); });
  const client = createAuthApiClient({ baseUrl: "https://gateway.example", fetch });
  await expect(client.verifyEmailChallenge(challengeId, {
    contractVersion: "1", requestId, code: "123456", installationToken: "installation-token-at-least-sixteen",
  })).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("does not depend on the Node-only AbortSignal.timeout helper", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(AbortSignal, "timeout");
  Object.defineProperty(AbortSignal, "timeout", {
    configurable: true,
    get() { throw new Error("not available in React Native"); },
  });
  try {
    const fetch = jest.fn(async () => Response.json({
      contractVersion: "1", requestId, challengeId, expiresInSeconds: 600, resendAfterSeconds: 60,
    }, { status: 202 }));
    const client = createAuthApiClient({ baseUrl: "https://gateway.example", fetch });
    await expect(client.requestEmailChallenge({
      contractVersion: "1", requestId, email: "person@example.com", installationToken: "installation-token-at-least-sixteen",
    })).resolves.toMatchObject({ challengeId });
  } finally {
    if (descriptor === undefined) delete (AbortSignal as unknown as { timeout?: unknown }).timeout;
    else Object.defineProperty(AbortSignal, "timeout", descriptor);
  }
});

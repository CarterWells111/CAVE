import { describe, expect, it, vi } from "vitest";

import { digestOpaqueToken } from "../src/auth/crypto";
import { InMemoryAuthRepository } from "../src/auth/in-memory-auth-repository";
import { AuthServiceError, createAuthService } from "../src/auth/service";

const requestId = "7cbbc0f9-9d12-4b08-9741-75bbb399e7c6";
const installationToken = "installation-token-at-least-sixteen";

function harness() {
  let nowMs = Date.parse("2026-08-28T17:00:00.000Z");
  let sequence = 0;
  const repository = new InMemoryAuthRepository();
  const emailSender = { sendCode: vi.fn(async () => undefined) };
  const service = createAuthService({
    repository,
    emailSender,
    emailLookupKeys: [{ version: 1, value: "email-lookup-key-with-32-bytes-minimum" }],
    otpKeys: [{ version: 1, value: "otp-digest-key-with-32-bytes-minimum" }],
    now: () => nowMs,
    createId: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
    createCode: () => "123456",
    createToken(kind) {
      sequence += 1;
      const prefix = kind === "access" ? "cave_at_" : kind === "refresh" ? "cave_rt_" : "cave_dg_";
      return `${prefix}${String(sequence).padStart(43, "a")}`;
    },
  });
  return {
    repository,
    emailSender,
    service,
    advance(ms: number) { nowMs += ms; },
  };
}

describe("email challenge service", () => {
  it("stores only keyed lookups while sending the raw address transiently", async () => {
    const { service, repository, emailSender } = harness();
    const accepted = await service.requestEmailChallenge({
      contractVersion: "1",
      requestId,
      email: " Person@Example.com ",
      installationToken,
    });

    expect(accepted).toMatchObject({ expiresInSeconds: 600, resendAfterSeconds: 60 });
    expect(emailSender.sendCode).toHaveBeenCalledWith(expect.objectContaining({
      to: "person@example.com",
      code: "123456",
      idempotencyKey: `auth-code/${accepted.challengeId}`,
    }));
    const challenge = await repository.getChallenge(accepted.challengeId);
    expect(challenge).not.toBeNull();
    expect(JSON.stringify(challenge)).not.toContain("person@example.com");
    expect(JSON.stringify(challenge)).not.toContain("123456");
  });

  it("invalidates a challenge if delivery fails", async () => {
    const { service, repository, emailSender } = harness();
    emailSender.sendCode.mockRejectedValueOnce(new Error("provider-down"));
    await expect(service.requestEmailChallenge({
      contractVersion: "1", requestId, email: "person@example.com", installationToken,
    })).rejects.toMatchObject({ code: "AUTH_DELIVERY_UNAVAILABLE", status: 503 });
    const challenges = await repository.listChallenges();
    expect(challenges).toHaveLength(1);
    expect(challenges[0]?.invalidatedAt).toBeDefined();
  });

  it("rate limits challenge delivery by keyed email and never sends the fourth code", async () => {
    const { service, emailSender } = harness();
    const input = { contractVersion: "1" as const, requestId, email: "person@example.com", installationToken };
    await service.requestEmailChallenge(input);
    await service.requestEmailChallenge(input);
    await service.requestEmailChallenge(input);
    await expect(service.requestEmailChallenge(input)).rejects.toMatchObject({
      code: "RATE_LIMITED", status: 429, retryAfterSeconds: expect.any(Number),
    });
    expect(emailSender.sendCode).toHaveBeenCalledTimes(3);
  });

  it("verifies once, creates an account, and returns type-separated session tokens", async () => {
    const { service } = harness();
    const accepted = await service.requestEmailChallenge({
      contractVersion: "1", requestId, email: "person@example.com", installationToken,
    });
    const session = await service.verifyEmailChallenge(accepted.challengeId, {
      contractVersion: "1", requestId, code: "123456", installationToken,
    });
    expect(session.account.id).toMatch(/^[0-9a-f-]{36}$/u);
    expect(session.session.accessToken).toMatch(/^cave_at_/u);
    expect(session.session.refreshToken).toMatch(/^cave_rt_/u);

    await expect(service.verifyEmailChallenge(accepted.challengeId, {
      contractVersion: "1", requestId, code: "123456", installationToken,
    })).rejects.toMatchObject({ code: "AUTH_CHALLENGE_INVALID" });
  });

  it("counts wrong codes and locks the challenge after five attempts", async () => {
    const { service } = harness();
    const accepted = await service.requestEmailChallenge({
      contractVersion: "1", requestId, email: "person@example.com", installationToken,
    });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(service.verifyEmailChallenge(accepted.challengeId, {
        contractVersion: "1", requestId, code: "000000", installationToken,
      })).rejects.toMatchObject({ code: "AUTH_INVALID_CODE" });
    }
    await expect(service.verifyEmailChallenge(accepted.challengeId, {
      contractVersion: "1", requestId, code: "000000", installationToken,
    })).rejects.toMatchObject({ code: "AUTH_TOO_MANY_ATTEMPTS" });
  });

  it("rejects expired challenges and a different installation", async () => {
    const first = harness();
    const accepted = await first.service.requestEmailChallenge({
      contractVersion: "1", requestId, email: "person@example.com", installationToken,
    });
    await expect(first.service.verifyEmailChallenge(accepted.challengeId, {
      contractVersion: "1", requestId, code: "123456", installationToken: "different-installation-token",
    })).rejects.toMatchObject({ code: "AUTH_CHALLENGE_INVALID" });
    first.advance(600_001);
    await expect(first.service.verifyEmailChallenge(accepted.challengeId, {
      contractVersion: "1", requestId, code: "123456", installationToken,
    })).rejects.toMatchObject({ code: "AUTH_CODE_EXPIRED" });
  });
});

describe("session lifecycle", () => {
  it("rotates refresh tokens and rejects a stale token outside the grace window", async () => {
    const { service, advance } = harness();
    const accepted = await service.requestEmailChallenge({
      contractVersion: "1", requestId, email: "person@example.com", installationToken,
    });
    const signedIn = await service.verifyEmailChallenge(accepted.challengeId, {
      contractVersion: "1", requestId, code: "123456", installationToken,
    });
    const refreshed = await service.refresh({
      contractVersion: "1", requestId, refreshToken: signedIn.session.refreshToken,
    });
    expect(refreshed.session.refreshToken).not.toBe(signedIn.session.refreshToken);

    advance(30_001);
    await expect(service.refresh({
      contractVersion: "1", requestId, refreshToken: signedIn.session.refreshToken,
    })).rejects.toMatchObject({ code: "AUTH_SESSION_EXPIRED" });
  });

  it("revokes the current session idempotently on logout", async () => {
    const { service, repository } = harness();
    const accepted = await service.requestEmailChallenge({
      contractVersion: "1", requestId, email: "person@example.com", installationToken,
    });
    const signedIn = await service.verifyEmailChallenge(accepted.challengeId, {
      contractVersion: "1", requestId, code: "123456", installationToken,
    });
    await service.logout({ contractVersion: "1", requestId, refreshToken: signedIn.session.refreshToken });
    await service.logout({ contractVersion: "1", requestId, refreshToken: signedIn.session.refreshToken });
    expect(await repository.findSessionByRefreshDigest(
      await digestOpaqueToken(signedIn.session.refreshToken),
    )).toMatchObject({ revokedAt: expect.any(String) });
  });

  it("does not rotate a previous refresh token again during the grace window", async () => {
    const { service } = harness();
    const accepted = await service.requestEmailChallenge({
      contractVersion: "1", requestId, email: "person@example.com", installationToken,
    });
    const signedIn = await service.verifyEmailChallenge(accepted.challengeId, {
      contractVersion: "1", requestId, code: "123456", installationToken,
    });
    const refreshed = await service.refresh({
      contractVersion: "1", requestId, refreshToken: signedIn.session.refreshToken,
    });

    await expect(service.refresh({
      contractVersion: "1", requestId, refreshToken: signedIn.session.refreshToken,
    })).rejects.toMatchObject({ code: "AUTH_SESSION_EXPIRED" });
    await expect(service.refresh({
      contractVersion: "1", requestId, refreshToken: refreshed.session.refreshToken,
    })).resolves.toMatchObject({ account: { id: signedIn.account.id } });
  });

  it("uses typed service errors rather than leaking internal messages", () => {
    expect(new AuthServiceError("AUTH_UNAUTHORIZED", 401).message).toBe("Authentication request failed");
  });
});

describe("account deletion", () => {
  async function signedIn() {
    const result = harness();
    const accepted = await result.service.requestEmailChallenge({
      contractVersion: "1", requestId, email: "person@example.com", installationToken,
    });
    const session = await result.service.verifyEmailChallenge(accepted.challengeId, {
      contractVersion: "1", requestId, code: "123456", installationToken,
    });
    return { ...result, session };
  }

  it("requires a live access token and the signed-in account email", async () => {
    const { service, session } = await signedIn();
    await expect(service.requestAccountDeletionChallenge("cave_at_" + "z".repeat(43), {
      contractVersion: "1", requestId, email: "person@example.com", installationToken,
    })).rejects.toMatchObject({ code: "AUTH_UNAUTHORIZED", status: 401 });
    await expect(service.requestAccountDeletionChallenge(session.session.accessToken, {
      contractVersion: "1", requestId, email: "other@example.com", installationToken,
    })).rejects.toMatchObject({ code: "AUTH_REAUTH_REQUIRED", status: 401 });
  });

  it("issues a five-minute one-use deletion grant after fresh verification", async () => {
    const { service, session, emailSender } = await signedIn();
    const challenge = await service.requestAccountDeletionChallenge(session.session.accessToken, {
      contractVersion: "1", requestId, email: "Person@example.com", installationToken,
    });
    expect(emailSender.sendCode).toHaveBeenLastCalledWith(expect.objectContaining({
      purpose: "account_delete",
      to: "person@example.com",
    }));
    const grant = await service.verifyAccountDeletionChallenge(challenge.challengeId, {
      contractVersion: "1", requestId, code: "123456", installationToken,
    });
    expect(grant).toMatchObject({ expiresInSeconds: 300 });
    expect(grant.deletionGrant).toMatch(/^cave_dg_/u);

    await service.deleteAccount({
      contractVersion: "1", requestId, deletionGrant: grant.deletionGrant, idempotencyKey: "delete-on-device-1",
    });
    await service.deleteAccount({
      contractVersion: "1", requestId, deletionGrant: grant.deletionGrant, idempotencyKey: "delete-on-device-1",
    });
    await expect(service.refresh({
      contractVersion: "1", requestId, refreshToken: session.session.refreshToken,
    })).rejects.toMatchObject({ code: "AUTH_SESSION_EXPIRED" });
  });

  it("rejects a deletion grant replay under a different idempotency key", async () => {
    const { service, session } = await signedIn();
    const challenge = await service.requestAccountDeletionChallenge(session.session.accessToken, {
      contractVersion: "1", requestId, email: "person@example.com", installationToken,
    });
    const grant = await service.verifyAccountDeletionChallenge(challenge.challengeId, {
      contractVersion: "1", requestId, code: "123456", installationToken,
    });
    await service.deleteAccount({
      contractVersion: "1", requestId, deletionGrant: grant.deletionGrant, idempotencyKey: "delete-1",
    });
    await expect(service.deleteAccount({
      contractVersion: "1", requestId, deletionGrant: grant.deletionGrant, idempotencyKey: "delete-2",
    })).rejects.toMatchObject({ code: "AUTH_REAUTH_REQUIRED" });
  });

  it("scopes an idempotency key to its deletion grant", async () => {
    const { service, repository } = harness();
    const deleteAccount = vi.spyOn(repository, "deleteAccountWithGrant").mockResolvedValue("deleted");
    const firstGrant = `cave_dg_${"a".repeat(43)}`;
    const secondGrant = `cave_dg_${"b".repeat(43)}`;

    await service.deleteAccount({
      contractVersion: "1", requestId, deletionGrant: firstGrant, idempotencyKey: "same-device-key",
    });
    await service.deleteAccount({
      contractVersion: "1", requestId, deletionGrant: secondGrant, idempotencyKey: "same-device-key",
    });

    expect(deleteAccount.mock.calls[0]?.[0].idempotencyDigest)
      .not.toBe(deleteAccount.mock.calls[1]?.[0].idempotencyDigest);
  });
});

describe("key management", () => {
  it("rejects short or reused server-side HMAC keys", () => {
    const repository = new InMemoryAuthRepository();
    const base = {
      repository,
      emailSender: { sendCode: vi.fn(async () => undefined) },
    };
    expect(() => createAuthService({
      ...base, emailLookupKeys: [{ version: 1, value: "short" }],
      otpKeys: [{ version: 1, value: "otp-digest-key-with-32-bytes-minimum" }],
    })).toThrow("email-lookup-key-too-short");
    const reused = "shared-key-material-with-32-bytes-minimum";
    expect(() => createAuthService({
      ...base, emailLookupKeys: [{ version: 1, value: reused }],
      otpKeys: [{ version: 1, value: reused }],
    })).toThrow("auth-key-reuse-forbidden");
  });

  it("keeps the same account while migrating a retained email lookup key", async () => {
    const repository = new InMemoryAuthRepository();
    const emailSender = { sendCode: vi.fn(async () => undefined) };
    const ids = [
      "00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003", "00000000-0000-4000-8000-000000000004",
      "00000000-0000-4000-8000-000000000005", "00000000-0000-4000-8000-000000000006",
    ];
    const common = {
      repository, emailSender, now: () => Date.parse("2026-08-28T17:00:00.000Z"),
      createCode: () => "123456", createId: () => ids.shift()!,
      createToken: (kind: "access" | "refresh" | "deletionGrant") => {
        const prefix = kind === "access" ? "cave_at_" : kind === "refresh" ? "cave_rt_" : "cave_dg_";
        return `${prefix}${crypto.randomUUID().replaceAll("-", "").padEnd(43, "a")}`;
      },
      otpKeys: [{ version: 1, value: "otp-digest-key-with-32-bytes-minimum" }],
    };
    const v1 = createAuthService({
      ...common, emailLookupKeys: [{ version: 1, value: "email-lookup-key-v1-with-32-bytes-min" }],
    });
    const firstChallenge = await v1.requestEmailChallenge({
      contractVersion: "1", requestId, email: "person@example.com", installationToken,
    });
    const first = await v1.verifyEmailChallenge(firstChallenge.challengeId, {
      contractVersion: "1", requestId, code: "123456", installationToken,
    });
    const staleV1Challenge = await v1.requestEmailChallenge({
      contractVersion: "1", requestId, email: "person@example.com", installationToken,
    });

    const v2 = createAuthService({
      ...common,
      emailLookupKeys: [
        { version: 2, value: "email-lookup-key-v2-with-32-bytes-min" },
        { version: 1, value: "email-lookup-key-v1-with-32-bytes-min" },
      ],
    });
    const secondChallenge = await v2.requestEmailChallenge({
      contractVersion: "1", requestId, email: "person@example.com", installationToken,
    });
    const second = await v2.verifyEmailChallenge(secondChallenge.challengeId, {
      contractVersion: "1", requestId, code: "123456", installationToken,
    });

    expect(second.account.id).toBe(first.account.id);
    await expect(v1.verifyEmailChallenge(staleV1Challenge.challengeId, {
      contractVersion: "1", requestId, code: "123456", installationToken,
    })).rejects.toMatchObject({ code: "AUTH_CHALLENGE_INVALID" });
  });
});

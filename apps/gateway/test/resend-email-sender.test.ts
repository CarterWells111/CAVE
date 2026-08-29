import { describe, expect, it, vi } from "vitest";

import { createResendAuthEmailSender } from "../src/auth/resend-email-sender";

describe("Resend authentication email adapter", () => {
  it("sends minimal text and html with an idempotency key and no tracking links", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ id: "email-1" }), { status: 200 }));
    const sender = createResendAuthEmailSender({ apiKey: "resend-secret", fetch });
    await sender.sendCode({
      to: "person@example.com",
      code: "123456",
      purpose: "sign_in",
      expiresInMinutes: 10,
      idempotencyKey: "auth-code/challenge-1",
    });
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer resend-secret",
      "Idempotency-Key": "auth-code/challenge-1",
    });
    const body = JSON.parse(String(init?.body)) as Record<string, string>;
    expect(body.from).toBe("内界 CAVE <support@neijiecave.com>");
    expect(body.text).toContain("123456");
    expect(body.html).toContain("123456");
    expect(JSON.stringify(body)).not.toMatch(/https?:\/\//u);
  });

  it("throws a body-free error on timeout or non-success", async () => {
    const sender = createResendAuthEmailSender({
      apiKey: "resend-secret",
      fetch: vi.fn(async () => new Response("provider-secret-body", { status: 429 })),
    });
    await expect(sender.sendCode({
      to: "person@example.com", code: "123456", purpose: "sign_in",
      expiresInMinutes: 10, idempotencyKey: "auth-code/challenge-1",
    })).rejects.toThrow("auth-email-delivery-failed:429");
  });
});

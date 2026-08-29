import type { AuthEmailSender } from "./email-sender";

type Dependencies = {
  apiKey: string;
  fetch?: typeof globalThis.fetch;
};

export function createResendAuthEmailSender({
  apiKey,
  fetch = globalThis.fetch,
}: Dependencies): AuthEmailSender {
  if (apiKey.trim().length === 0) throw new Error("resend-api-key-required");
  return {
    async sendCode(input) {
      const action = input.purpose === "account_delete" ? "删除账户" : "登录";
      const text = `你的内界 CAVE ${action}验证码是：${input.code}\n\n验证码在 ${input.expiresInMinutes} 分钟内有效，请勿转发。若非本人操作，可以忽略此邮件。`;
      const html = `<p>你的内界 CAVE ${action}验证码是：</p><p><strong>${input.code}</strong></p><p>验证码在 ${input.expiresInMinutes} 分钟内有效，请勿转发。若非本人操作，可以忽略此邮件。</p>`;
      let response: Response;
      try {
        response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": input.idempotencyKey,
            "User-Agent": "neijie-cave-gateway/1",
          },
          body: JSON.stringify({
            from: "内界 CAVE <support@neijiecave.com>",
            to: [input.to],
            subject: `内界 CAVE ${action}验证码`,
            text,
            html,
          }),
          signal: AbortSignal.timeout(8_000),
        });
      } catch {
        throw new Error("auth-email-delivery-failed:network");
      }
      if (!response.ok) throw new Error(`auth-email-delivery-failed:${response.status}`);
    },
  };
}

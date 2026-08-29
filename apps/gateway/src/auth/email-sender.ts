import type { AuthChallengePurpose } from "./repository";

export type SendAuthCodeInput = {
  to: string;
  code: string;
  purpose: AuthChallengePurpose;
  expiresInMinutes: number;
  idempotencyKey: string;
};

export interface AuthEmailSender {
  sendCode(input: SendAuthCodeInput): Promise<void>;
}

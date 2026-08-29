import { z } from "zod";

const ContractVersionSchema = z.literal("1");
const RequestIdSchema = z.string().uuid();
const InstallationTokenSchema = z.string().min(16).max(256);
const EmailSchema = z.string().trim().min(3).max(254).email();
const ChallengeIdSchema = z.string().uuid();
const AccountIdSchema = z.string().uuid();
const IsoDateTimeSchema = z.string().datetime({ offset: true });
const AccessTokenSchema = z.string().regex(/^cave_at_[A-Za-z0-9_-]{43}$/u);
const RefreshTokenSchema = z.string().regex(/^cave_rt_[A-Za-z0-9_-]{43}$/u);
const DeletionGrantSchema = z.string().regex(/^cave_dg_[A-Za-z0-9_-]{43}$/u);

export const EmailChallengeRequestSchema = z.object({
  contractVersion: ContractVersionSchema,
  requestId: RequestIdSchema,
  email: EmailSchema,
  installationToken: InstallationTokenSchema,
}).strict();

export const EmailChallengeAcceptedSchema = z.object({
  contractVersion: ContractVersionSchema,
  requestId: RequestIdSchema,
  challengeId: ChallengeIdSchema,
  expiresInSeconds: z.number().int().positive(),
  resendAfterSeconds: z.number().int().positive(),
}).strict();

export const EmailChallengeVerifyRequestSchema = z.object({
  contractVersion: ContractVersionSchema,
  requestId: RequestIdSchema,
  code: z.string().regex(/^\d{6}$/u),
  installationToken: InstallationTokenSchema,
}).strict();

export const SessionTokensSchema = z.object({
  accessToken: AccessTokenSchema,
  accessExpiresAt: IsoDateTimeSchema,
  refreshToken: RefreshTokenSchema,
  refreshExpiresAt: IsoDateTimeSchema,
}).strict();

export const AuthSessionResponseSchema = z.object({
  contractVersion: ContractVersionSchema,
  requestId: RequestIdSchema,
  account: z.object({ id: AccountIdSchema }).strict(),
  session: SessionTokensSchema,
}).strict();

export const RefreshSessionRequestSchema = z.object({
  contractVersion: ContractVersionSchema,
  requestId: RequestIdSchema,
  refreshToken: RefreshTokenSchema,
}).strict();

export const LogoutSessionRequestSchema = RefreshSessionRequestSchema;

export const AccountDeletionChallengeRequestSchema = EmailChallengeRequestSchema;

export const AccountDeletionGrantResponseSchema = z.object({
  contractVersion: ContractVersionSchema,
  requestId: RequestIdSchema,
  deletionGrant: DeletionGrantSchema,
  expiresInSeconds: z.number().int().positive(),
}).strict();

export const AccountDeletionRequestSchema = z.object({
  contractVersion: ContractVersionSchema,
  requestId: RequestIdSchema,
  deletionGrant: DeletionGrantSchema,
  idempotencyKey: z.string().min(1).max(128),
}).strict();

export type EmailChallengeRequest = z.infer<typeof EmailChallengeRequestSchema>;
export type EmailChallengeAccepted = z.infer<typeof EmailChallengeAcceptedSchema>;
export type EmailChallengeVerifyRequest = z.infer<typeof EmailChallengeVerifyRequestSchema>;
export type SessionTokens = z.infer<typeof SessionTokensSchema>;
export type AuthSessionResponse = z.infer<typeof AuthSessionResponseSchema>;
export type RefreshSessionRequest = z.infer<typeof RefreshSessionRequestSchema>;
export type LogoutSessionRequest = z.infer<typeof LogoutSessionRequestSchema>;
export type AccountDeletionChallengeRequest = z.infer<typeof AccountDeletionChallengeRequestSchema>;
export type AccountDeletionGrantResponse = z.infer<typeof AccountDeletionGrantResponseSchema>;
export type AccountDeletionRequest = z.infer<typeof AccountDeletionRequestSchema>;

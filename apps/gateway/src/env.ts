import { z } from "zod";

const SAFE_VERSION_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
  });
}

const VersionSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(
    (value) =>
      !containsControlCharacter(value) && SAFE_VERSION_IDENTIFIER.test(value),
    "version must be a safe identifier"
  );
const NonBlankSecretSchema = z.string().trim().min(1);
const HttpsBaseUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "https:";
    } catch {
      return false;
    }
  }, "MODEL_BASE_URL must use https")
  .transform((value) => value.replace(/\/+$/, ""));

const MockGatewayEnvSchema = z.object({
  MODEL_MODE: z.literal("mock"),
  PROMPT_VERSION: VersionSchema,
  POLICY_VERSION: VersionSchema
});

const LiveGatewayEnvSchema = z.object({
  MODEL_MODE: z.literal("live"),
  PROMPT_VERSION: VersionSchema,
  POLICY_VERSION: VersionSchema,
  MODEL_BASE_URL: HttpsBaseUrlSchema,
  MODEL_API_KEY: NonBlankSecretSchema,
  MODEL_NAME: z.string().trim().min(1)
});

export const GatewayEnvSchema = z.discriminatedUnion("MODEL_MODE", [
  MockGatewayEnvSchema,
  LiveGatewayEnvSchema
]);

export type GatewayEnv = z.infer<typeof GatewayEnvSchema>;
export type MockGatewayEnv = z.infer<typeof MockGatewayEnvSchema>;
export type LiveGatewayEnv = z.infer<typeof LiveGatewayEnvSchema>;

export function parseGatewayEnv(value: unknown): GatewayEnv {
  return GatewayEnvSchema.parse(value);
}

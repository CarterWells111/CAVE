import { z } from "zod";

const AddressPreferenceSchema = z.enum(["你", "妳"]).nullable();
const RevisionSchema = z.number().int().nonnegative();

export const AccountPreferencesSchema = z.object({
  ageConfirmed: z.boolean(),
  addressPreference: AddressPreferenceSchema,
  updatedAt: z.string().datetime({ offset: true }).nullable(),
  revision: RevisionSchema,
}).strict();

export const AccountPreferencesResponseSchema = z.object({
  contractVersion: z.literal("1"),
  requestId: z.string().uuid(),
  preferences: AccountPreferencesSchema,
}).strict();

export const UpdateAccountPreferencesRequestSchema = z.object({
  contractVersion: z.literal("1"),
  requestId: z.string().uuid(),
  expectedRevision: RevisionSchema,
  changes: z.object({
    ageConfirmed: z.boolean().optional(),
    addressPreference: AddressPreferenceSchema.optional(),
  }).strict().refine((changes) => changes.ageConfirmed !== undefined || changes.addressPreference !== undefined),
}).strict();

export type AccountPreferences = z.infer<typeof AccountPreferencesSchema>;
export type AccountPreferencesResponse = z.infer<typeof AccountPreferencesResponseSchema>;
export type UpdateAccountPreferencesRequest = z.infer<typeof UpdateAccountPreferencesRequestSchema>;

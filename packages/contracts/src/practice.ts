import { z } from "zod";

import {
  DebriefKeySchema,
  IdSchema,
  ScenarioStageSchema
} from "./content";
import { SafetyDecisionSchema } from "./safety";

const ContractVersionSchema = z.literal("1");
const LocaleSchema = z.literal("zh-CN");
const RequestIdSchema = z.string().min(1);
const InstallationTokenSchema = z.string().min(1);
const ScenarioVersionSchema = z.number().int().positive();

export const PracticeTurnSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    text: z.string()
  })
  .strict();

export const PracticeTurnRequestSchema = z
  .object({
    contractVersion: ContractVersionSchema,
    requestId: RequestIdSchema,
    installationToken: InstallationTokenSchema,
    locale: LocaleSchema,
    scenarioId: IdSchema,
    scenarioVersion: ScenarioVersionSchema,
    scenarioStage: ScenarioStageSchema,
    selectedOptions: z.record(z.string(), z.string()),
    recentTurns: z.array(PracticeTurnSchema).max(8),
    userMessage: z.string().max(500)
  })
  .strict();

export const PracticeTurnResponseSchema = z
  .object({
    contractVersion: ContractVersionSchema,
    requestId: RequestIdSchema,
    roleMessage: z.string(),
    nextStage: ScenarioStageSchema,
    shouldEnd: z.boolean(),
    safety: SafetyDecisionSchema,
    promptVersion: z.string().min(1),
    policyVersion: z.string().min(1)
  })
  .strict();

export const DebriefDimensionSchema = z
  .object({
    key: DebriefKeySchema,
    status: z.enum(["expressed", "could_be_clearer", "not_observed"]),
    evidenceQuote: z.string().min(1).optional(),
    explanation: z.string().min(1),
    optionalAlternative: z.string().min(1).optional()
  })
  .strict();

export const ExpressionCardSchema = z
  .object({
    feeling: z.string().min(1).optional(),
    willingness: z.string().min(1).optional(),
    boundary: z.string().min(1).optional(),
    nextStep: z.string().min(1).optional()
  })
  .strict();

export const DebriefRequestSchema = z
  .object({
    contractVersion: ContractVersionSchema,
    requestId: RequestIdSchema,
    installationToken: InstallationTokenSchema,
    locale: LocaleSchema,
    scenarioId: IdSchema,
    scenarioVersion: ScenarioVersionSchema,
    turns: z.array(PracticeTurnSchema)
  })
  .strict();

export const DebriefResponseSchema = z
  .object({
    contractVersion: ContractVersionSchema,
    requestId: RequestIdSchema,
    dimensions: z.array(DebriefDimensionSchema),
    expressionCard: ExpressionCardSchema,
    linkedLessonIds: z.array(IdSchema),
    promptVersion: z.string().min(1),
    policyVersion: z.string().min(1)
  })
  .strict();

export type PracticeTurn = z.infer<typeof PracticeTurnSchema>;
export type PracticeTurnRequest = z.infer<typeof PracticeTurnRequestSchema>;
export type PracticeTurnResponse = z.infer<typeof PracticeTurnResponseSchema>;
export type DebriefDimension = z.infer<typeof DebriefDimensionSchema>;
export type ExpressionCard = z.infer<typeof ExpressionCardSchema>;
export type DebriefRequest = z.infer<typeof DebriefRequestSchema>;
export type DebriefResponse = z.infer<typeof DebriefResponseSchema>;

import { z } from "zod";

const JourneyReviewFields = {
  page: z.number().int().min(1).max(7),
  contentType: z.enum(["MED", "EDU", "UX", "REVIEW"]),
  sourceIds: z.array(z.string().min(1)),
  reviewStatus: z.enum([
    "draft",
    "expert_review_pending",
    "internal_test_approved",
    "reviewed",
    "revision_required"
  ]),
  reviewer: z.string().min(1).optional(),
  reviewerRole: z.string().min(1).optional(),
  reviewedAt: z.string().datetime({ offset: true }).optional(),
  reviewedVersion: z.string().min(1).optional(),
  reviewConclusion: z.string().min(1).optional()
};

const CopyId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const JourneyOptionSchema = z.object({
  id: CopyId,
  group: z.enum(["expectation", "concern", "behavior", "motivation", "comfort", "health"]),
  order: z.number().int().positive(),
  label: z.string().min(1),
  exclusive: z.boolean().optional(),
  ...JourneyReviewFields
}).strict();

const JourneyKnowledgeSchema = z.object({
  id: CopyId,
  order: z.number().int().positive(),
  title: z.string().min(1),
  body: z.string().min(1),
  ...JourneyReviewFields
}).strict();

const JourneyPhraseSchema = z.object({
  id: CopyId,
  intent: z.string().min(1),
  order: z.number().int().positive(),
  text: z.string().min(1),
  ...JourneyReviewFields
}).strict();

const JourneyResponseSchema = z.object({
  id: CopyId,
  branch: z.string().min(1),
  text: z.string().min(1),
  scripted: z.literal(true),
  safeTerminal: z.boolean(),
  ...JourneyReviewFields
}).strict();

const JourneyPartnerResponseSchema = z.object({
  id: CopyId,
  intent: z.string().min(1),
  order: z.number().int().positive(),
  text: z.string().min(1),
  ...JourneyReviewFields
}).strict();

const JourneySafetyBranchSchema = z.object({
  id: CopyId,
  branch: z.string().min(1),
  order: z.number().int().positive(),
  partnerText: z.string().min(1),
  userTexts: z.array(z.string().min(1)),
  guidance: z.string().min(1),
  safeTerminal: z.boolean(),
  ...JourneyReviewFields
}).strict();

const JourneySupportResourceSchema = z.object({
  id: CopyId,
  order: z.number().int().positive(),
  number: z.enum(["110", "120", "12338", "12348"]),
  label: z.string().min(1),
  usage: z.string().min(1),
  region: z.literal("CN"),
  autoDial: z.literal(false),
  ...JourneyReviewFields
}).strict();

const JourneyPracticeSchema = z.object({
  version: z.string().min(1),
  scripted: z.literal(true),
  phrases: z.array(JourneyPhraseSchema),
  responses: z.array(JourneyResponseSchema),
  partnerResponses: z.array(JourneyPartnerResponseSchema),
  safetyBranches: z.array(JourneySafetyBranchSchema),
  supportResources: z.array(JourneySupportResourceSchema)
}).strict();

const JourneySourceSchema = z.object({
  id: z.string().regex(/^SRC-\d{3}$/),
  sourceType: z.enum(["MED", "EDU", "SAFE"]),
  title: z.string().min(1),
  organization: z.string().min(1),
  url: z.string().url(),
  appliesTo: z.string().min(1),
  publicationOrReviewDate: z.string().min(1),
  accessedAt: z.string().date(),
  verificationStatus: z.enum(["source_verified", "revision_required"])
}).strict();

const JourneyBehaviorMapPointSchema = z.object({
  id: CopyId,
  order: z.number().int().positive(),
  label: z.string().min(1),
  kind: z.enum(["behavior", "more", "custom"]),
  behaviorIds: z.array(z.string().min(1)),
  ...JourneyReviewFields
}).strict();

const JourneyAttitudeSchema = z.object({
  id: CopyId,
  order: z.number().int().positive(),
  value: z.enum(["expecting", "familiar-enjoyed", "decide-in-moment", "unsure", "not-this-time", "skip"]),
  label: z.string().min(1),
  feedback: z.string().min(1),
  ...JourneyReviewFields
}).strict();

const JourneyCommunicationSectionSchema = z.object({
  id: CopyId,
  order: z.number().int().positive(),
  title: z.string().min(1),
  defaultVisibility: z.literal("private"),
  confirmationRequired: z.literal(true),
  ...JourneyReviewFields
}).strict();

const JourneyBodyKnowledgeDefinitionSchema = z.object({
  id: CopyId,
  title: z.string().min(1),
  intro: z.string().min(1),
  examples: z.array(z.string().min(1)).length(4),
  conclusion: z.string().min(1),
  ...JourneyReviewFields
}).strict();

const JourneyUiCopySchema = z.object({
  version: z.string().min(1),
  bodyKnowledgeDefinition: JourneyBodyKnowledgeDefinitionSchema,
  behaviorMapPoints: z.array(JourneyBehaviorMapPointSchema),
  attitudes: z.array(JourneyAttitudeSchema),
  communicationSections: z.array(JourneyCommunicationSectionSchema)
}).strict();

export const MobileJourneyContentCatalogSchema = z.object({
  options: z.array(JourneyOptionSchema),
  knowledge: z.array(JourneyKnowledgeSchema),
  practice: JourneyPracticeSchema,
  uiCopy: JourneyUiCopySchema
}).strict();

export const JourneyContentCatalogSchema = MobileJourneyContentCatalogSchema.extend({
  sources: z.array(JourneySourceSchema)
}).strict();

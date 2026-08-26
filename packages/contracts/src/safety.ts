import { z } from "zod";

import { StopRuleCodeSchema } from "./content";

export const SafetyDecisionSchema = z
  .object({
    level: z.enum(["safe", "stop"]),
    reasonCode: z.union([
      z.literal("none"),
      StopRuleCodeSchema,
      z.enum(["policy_violation", "uncertain"])
    ]),
    resourceCategory: z
      .enum(["emergency", "violence", "self_harm", "medical", "minor"])
      .optional()
  })
  .strict()
  .superRefine((decision, context) => {
    if (decision.level === "safe" && decision.reasonCode !== "none") {
      context.addIssue({
        code: "custom",
        message: "safe decisions require reasonCode none",
        path: ["reasonCode"]
      });
    }

    if (decision.level === "stop" && decision.reasonCode === "none") {
      context.addIssue({
        code: "custom",
        message: "stop decisions require a non-none reasonCode",
        path: ["reasonCode"]
      });
    }
  });

export type SafetyDecision = z.infer<typeof SafetyDecisionSchema>;

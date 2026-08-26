import {
  PracticeTurnRequestSchema,
  type PracticeTurnRequest
} from "@hackathon/contracts";

declare const request: PracticeTurnRequest;
PracticeTurnRequestSchema.parse(request);

// @ts-expect-error v1 consumers must not deep import contract modules.
type MobileDeepImport = typeof import("@hackathon/contracts/src/practice");

export type { MobileDeepImport };

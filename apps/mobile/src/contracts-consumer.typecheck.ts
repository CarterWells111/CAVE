import {
  PracticeTurnRequestSchema,
  type PracticeTurnRequest
} from "@cave/contracts";

declare const request: PracticeTurnRequest;
PracticeTurnRequestSchema.parse(request);

// @ts-expect-error v1 consumers must not deep import contract modules.
type MobileDeepImport = typeof import("@cave/contracts/src/practice");

export type { MobileDeepImport };

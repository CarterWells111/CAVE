import {
  ApiErrorResponseSchema,
  type ApiErrorResponse
} from "@cave/contracts";

declare const response: ApiErrorResponse;
ApiErrorResponseSchema.parse(response);

// @ts-expect-error v1 consumers must not deep import contract modules.
type GatewayDeepImport = typeof import("@cave/contracts/src/errors");

export type { GatewayDeepImport };

import {
  DebriefRequestSchema,
  PracticeTurnRequestSchema,
  type ApiErrorResponse,
  type DebriefRequest,
  type PracticeTurnRequest
} from "@cave/contracts";

export const MAX_REQUEST_BYTES = 16 * 1024;

export type PracticeRoute = "turn" | "debrief";

type GuardSuccess = {
  ok: true;
  value: PracticeTurnRequest | DebriefRequest;
};

type GuardFailure = {
  ok: false;
  status: 400 | 413;
  error: ApiErrorResponse;
};

export type RequestGuardResult = GuardSuccess | GuardFailure;

function failure(
  code: "INVALID_REQUEST" | "CONTRACT_MISMATCH",
  requestId = "invalid-request",
  status: 400 | 413 = 400
): GuardFailure {
  return {
    ok: false,
    status,
    error: {
      contractVersion: "1",
      requestId,
      code,
      messageKey: code === "CONTRACT_MISMATCH"
        ? "errors.contractMismatch"
        : "errors.invalidRequest"
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type BoundedBody =
  | { ok: true; text: string }
  | { ok: false; tooLarge: true };

async function readBoundedBody(request: Request): Promise<BoundedBody> {
  if (request.body === null) return { ok: true, text: "" };

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      byteLength += result.value.byteLength;
      if (byteLength > MAX_REQUEST_BYTES) {
        try {
          await reader.cancel("request body exceeds limit");
        } catch {
          // Rejection remains authoritative even when the source cannot be cancelled.
        }
        return { ok: false, tooLarge: true };
      }
      parts.push(decoder.decode(result.value, { stream: true }));
    }
    parts.push(decoder.decode());
    return { ok: true, text: parts.join("") };
  } finally {
    reader.releaseLock();
  }
}

export async function guardPracticeRequest(
  request: Request,
  route: PracticeRoute,
  knownScenarioIds: ReadonlySet<string>
): Promise<RequestGuardResult> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) return failure("INVALID_REQUEST");

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return failure("INVALID_REQUEST", "invalid-request", 413);
  }

  let boundedBody: BoundedBody;
  try {
    boundedBody = await readBoundedBody(request);
  } catch {
    return failure("INVALID_REQUEST");
  }
  if (!boundedBody.ok) {
    return failure("INVALID_REQUEST", "invalid-request", 413);
  }
  const text = boundedBody.text;

  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    return failure("INVALID_REQUEST");
  }
  const requestId = isRecord(body) && typeof body.requestId === "string"
    ? body.requestId
    : "invalid-request";
  if (isRecord(body) && body.contractVersion !== "1") {
    return failure("CONTRACT_MISMATCH", requestId);
  }

  const schema = route === "turn" ? PracticeTurnRequestSchema : DebriefRequestSchema;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return failure("INVALID_REQUEST", requestId);
  if (!knownScenarioIds.has(parsed.data.scenarioId)) {
    return failure("INVALID_REQUEST", requestId);
  }
  return { ok: true, value: parsed.data };
}

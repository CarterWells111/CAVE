const ALLOWED_FIELDS = [
  "requestId",
  "route",
  "status",
  "latencyMs",
  "model",
  "providerMode",
  "promptVersion",
  "policyVersion",
  "inputChars",
  "outputChars",
  "inputTokens",
  "outputTokens",
  "safetyReasonCode"
] as const;

export type SafeLogField = (typeof ALLOWED_FIELDS)[number];
export type SafeLogRecord = Partial<Record<SafeLogField, string | number>>;

const OPAQUE_REQUEST_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function safeRequestId(value: unknown): string {
  return typeof value === "string" && OPAQUE_REQUEST_ID.test(value)
    ? value
    : "invalid-request-id";
}

export function mapSafeLog(input: Readonly<Record<string, unknown>>): SafeLogRecord {
  const output: SafeLogRecord = {};
  for (const field of ALLOWED_FIELDS) {
    const value = input[field];
    if (field === "requestId" && value !== undefined) {
      output.requestId = safeRequestId(value);
      continue;
    }
    if (typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) {
      output[field] = value;
    }
  }
  return output;
}

export function safeLogEvent(input: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(mapSafeLog(input));
}

export function mapProviderError(input: unknown): {
  kind: "provider_error";
  status?: number;
} {
  if (typeof input === "object" && input !== null && "status" in input) {
    const status = (input as { status?: unknown }).status;
    if (typeof status === "number" && Number.isInteger(status)) {
      return { kind: "provider_error", status };
    }
  }
  return { kind: "provider_error" };
}

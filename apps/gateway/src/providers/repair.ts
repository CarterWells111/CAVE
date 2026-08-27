import type { z } from "zod";

import { assertNotAborted } from "./types";

export type ProviderRepairInput = {
  invalidJson: string;
  targetSchemaDescription: string;
};

export interface JsonRepairer {
  repairJson(input: ProviderRepairInput, signal: AbortSignal): Promise<unknown>;
}

export type RepairPolicy = {
  preserve(original: unknown, repaired: unknown): boolean;
};

export class InvalidModelOutputError extends Error {
  readonly code = "INVALID_MODEL_OUTPUT" as const;

  constructor() {
    super("Model output did not match the required schema");
    this.name = "InvalidModelOutputError";
  }
}

type ParseProviderOutputOptions<T> = {
  raw: unknown;
  schema: z.ZodType<T>;
  schemaDescription: string;
  repairer?: JsonRepairer | undefined;
  repairPolicy?: RepairPolicy | undefined;
  signal: AbortSignal;
};

function serialized(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable model output]";
  }
}

type DecodedOutput = {
  parsed: boolean;
  value: unknown;
};

function decoded(value: unknown): DecodedOutput {
  if (typeof value !== "string") return { parsed: true, value };
  try {
    return { parsed: true, value: JSON.parse(value) as unknown };
  } catch {
    return { parsed: false, value };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function structurallyEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => structurallyEqual(value, right[index]))
    );
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return (
      structurallyEqual(leftKeys, rightKeys) &&
      leftKeys.every((key) => structurallyEqual(left[key], right[key]))
    );
  }
  return false;
}

export function preserveStructuredFields(
  fields: readonly string[]
): RepairPolicy["preserve"] {
  return (original, repaired) => {
    if (!isRecord(original) || !isRecord(repaired)) return false;
    return fields.every((field) => {
      const originalHasField = Object.hasOwn(original, field);
      const repairedHasField = Object.hasOwn(repaired, field);
      return (
        originalHasField === repairedHasField &&
        (!originalHasField || structurallyEqual(original[field], repaired[field]))
      );
    });
  };
}

function containsStructuredStop(value: unknown): boolean {
  if (value === "safety_stop") return true;
  if (Array.isArray(value)) return value.some(containsStructuredStop);
  if (!isRecord(value)) return false;
  if (value.level === "stop" || value.stop === true) return true;
  return Object.values(value).some(containsStructuredStop);
}

const PROTECTED_CONTENT_FIELDS = new Set([
  "dialogue",
  "evidence",
  "evidenceQuote",
  "roleMessage",
  "explanation",
  "optionalAlternative",
  "expressionCard",
  "turns"
]);

function protectedContentProjection(
  value: unknown,
  entries: Array<[string, unknown]> = []
): Array<[string, unknown]> {
  if (Array.isArray(value)) {
    value.forEach((item) => protectedContentProjection(item, entries));
    return entries;
  }
  if (!isRecord(value)) return entries;
  for (const [key, item] of Object.entries(value)) {
    if (PROTECTED_CONTENT_FIELDS.has(key)) {
      entries.push([key, item]);
    } else {
      protectedContentProjection(item, entries);
    }
  }
  return entries;
}

type ScannedString = {
  end: number;
  value: string;
};

function scanJsonString(source: string, start: number): ScannedString | undefined {
  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === '"') {
      try {
        const value = JSON.parse(source.slice(start, index + 1)) as unknown;
        return typeof value === "string" ? { end: index + 1, value } : undefined;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

type ScannedValue = {
  end: number;
  value: unknown;
};

function scanJsonValue(source: string, start: number): ScannedValue | undefined {
  const first = source[start];
  if (first === undefined) return undefined;
  if (first === '"') {
    const stringValue = scanJsonString(source, start);
    return stringValue
      ? { end: stringValue.end, value: stringValue.value }
      : undefined;
  }
  if (first === "{" || first === "[") {
    const stack = [first === "{" ? "}" : "]"];
    for (let index = start + 1; index < source.length; index += 1) {
      const character = source[index];
      if (character === '"') {
        const stringValue = scanJsonString(source, index);
        if (!stringValue) return undefined;
        index = stringValue.end - 1;
        continue;
      }
      if (character === "{") stack.push("}");
      else if (character === "[") stack.push("]");
      else if (character === "}" || character === "]") {
        if (stack.pop() !== character) return undefined;
        if (stack.length === 0) {
          const end = index + 1;
          try {
            return {
              end,
              value: JSON.parse(source.slice(start, end)) as unknown
            };
          } catch {
            return undefined;
          }
        }
      }
    }
    return undefined;
  }

  let end = start;
  while (end < source.length && !",}]".includes(source[end] ?? "")) end += 1;
  const raw = source.slice(start, end).trim();
  if (raw.length === 0) return undefined;
  try {
    return { end, value: JSON.parse(raw) as unknown };
  } catch {
    return undefined;
  }
}

type LexicalInspection = {
  safe: boolean;
  fields: Record<string, unknown>;
  protectedContent: Array<[string, unknown]>;
};

function inspectMalformedJson(source: string): LexicalInspection {
  const fields: Record<string, unknown> = {};
  const protectedContent: Array<[string, unknown]> = [];

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      const token = scanJsonString(source, index);
      if (!token) return { safe: false, fields, protectedContent };
      const normalizedToken = token.value.toLowerCase();
      if (normalizedToken === "stop" || normalizedToken === "safety_stop") {
        return { safe: false, fields, protectedContent };
      }

      let next = token.end;
      while (/\s/.test(source[next] ?? "")) next += 1;
      if (source[next] === ":") {
        let valueStart = next + 1;
        while (/\s/.test(source[valueStart] ?? "")) valueStart += 1;
        const scannedValue = scanJsonValue(source, valueStart);
        if (!scannedValue) {
          if (PROTECTED_CONTENT_FIELDS.has(token.value)) {
            return { safe: false, fields, protectedContent };
          }
        } else {
          fields[token.value] = scannedValue.value;
          if (PROTECTED_CONTENT_FIELDS.has(token.value)) {
            protectedContent.push([token.value, scannedValue.value]);
          }
        }
      } else if (
        PROTECTED_CONTENT_FIELDS.has(token.value) &&
        next >= source.length
      ) {
        return { safe: false, fields, protectedContent };
      }
      index = token.end - 1;
      continue;
    }

    if (/[A-Za-z_]/.test(character ?? "")) {
      let end = index + 1;
      while (/[A-Za-z0-9_]/.test(source[end] ?? "")) end += 1;
      const bareToken = source.slice(index, end).toLowerCase();
      if (bareToken === "stop" || bareToken === "safety_stop") {
        return { safe: false, fields, protectedContent };
      }
      index = end - 1;
    }
  }

  return { safe: true, fields, protectedContent };
}

export async function parseProviderOutput<T>(
  options: ParseProviderOutputOptions<T>
): Promise<T> {
  assertNotAborted(options.signal);
  const original = decoded(options.raw);
  const initial = options.schema.safeParse(original.value);
  if (initial.success) return initial.data;

  const invalidJson = serialized(options.raw);
  const lexicalInspection = original.parsed
    ? undefined
    : inspectMalformedJson(invalidJson);
  if (
    !options.repairer ||
    lexicalInspection?.safe === false ||
    (original.parsed && containsStructuredStop(original.value))
  ) {
    throw new InvalidModelOutputError();
  }

  const repaired = await options.repairer.repairJson(
    {
      invalidJson,
      targetSchemaDescription: options.schemaDescription
    },
    options.signal
  );
  assertNotAborted(options.signal);

  const decodedRepair = decoded(repaired);
  const result = options.schema.safeParse(decodedRepair.value);
  const originalForPolicy = original.parsed
    ? original.value
    : lexicalInspection?.fields;
  const originalProtectedContent = original.parsed
    ? protectedContentProjection(original.value)
    : (lexicalInspection?.protectedContent ?? []);
  if (
    !decodedRepair.parsed ||
    !result.success ||
    containsStructuredStop(result.data) ||
    !structurallyEqual(
      originalProtectedContent,
      protectedContentProjection(result.data)
    ) ||
    (options.repairPolicy &&
      !options.repairPolicy.preserve(originalForPolicy, result.data))
  ) {
    throw new InvalidModelOutputError();
  }
  return result.data;
}

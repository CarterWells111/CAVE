import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  InvalidModelOutputError,
  parseProviderOutput,
  preserveStructuredFields,
  type JsonRepairer,
  type ProviderRepairInput
} from "../src/providers/repair";

const schema = z.object({ value: z.string() }).strict();

describe("one-time provider JSON repair", () => {
  it("repairs syntactically malformed JSON once", async () => {
    let calls = 0;
    const repairer: JsonRepairer = {
      async repairJson() {
        calls += 1;
        return '{"value":"fixed"}';
      }
    };

    await expect(
      parseProviderOutput({
        raw: '{"value":',
        schema,
        schemaDescription: "strict object with string value",
        repairer,
        signal: new AbortController().signal
      })
    ).resolves.toEqual({ value: "fixed" });
    expect(calls).toBe(1);
  });

  it("fails after the single repair attempt remains malformed", async () => {
    let calls = 0;
    const repairer: JsonRepairer = {
      async repairJson() {
        calls += 1;
        return '{"value":';
      }
    };

    await expect(
      parseProviderOutput({
        raw: '{"value":',
        schema,
        schemaDescription: "strict object with string value",
        repairer,
        signal: new AbortController().signal
      })
    ).rejects.toBeInstanceOf(InvalidModelOutputError);
    expect(calls).toBe(1);
  });

  it("fails closed before repair when a protected field is truncated", async () => {
    let calls = 0;
    const repairer: JsonRepairer = {
      async repairJson() {
        calls += 1;
        return { value: "fixed" };
      }
    };

    await expect(
      parseProviderOutput({
        raw: '{"roleMessage":"unfinished',
        schema,
        schemaDescription: "strict object with string value",
        repairer,
        signal: new AbortController().signal
      })
    ).rejects.toBeInstanceOf(InvalidModelOutputError);
    expect(calls).toBe(0);
  });

  it("sends only invalid JSON and the target schema description to repair", async () => {
    let captured: ProviderRepairInput | undefined;
    const repairer: JsonRepairer = {
      async repairJson(input) {
        captured = input;
        return { value: "fixed" };
      }
    };

    await parseProviderOutput({
      raw: { value: 1 },
      schema,
      schemaDescription: "strict object with string value",
      repairer,
      signal: new AbortController().signal
    });

    expect(captured).toEqual({
      invalidJson:
        '{"value":1}',
      targetSchemaDescription: "strict object with string value"
    });
    expect(Object.keys(captured ?? {})).toEqual([
      "invalidJson",
      "targetSchemaDescription"
    ]);
  });

  it.each(["safety_stop", '"level":"stop"'])(
    "never repairs a protected stop marker (%s) into safe output",
    async (marker) => {
      const repairer: JsonRepairer = {
        async repairJson() {
          return { value: "safe" };
        }
      };

      await expect(
        parseProviderOutput({
          raw: `{"broken":"${marker}"`,
          schema,
          schemaDescription: "strict object with string value",
          repairer,
          repairPolicy: {
            preserve: preserveStructuredFields(["broken"])
          },
          signal: new AbortController().signal
        })
      ).rejects.toBeInstanceOf(InvalidModelOutputError);
    }
  );

  it("detects unicode-escaped stop structurally and fails closed", async () => {
    let calls = 0;
    const repairer: JsonRepairer = {
      async repairJson() {
        calls += 1;
        return { value: "safe" };
      }
    };

    await expect(
      parseProviderOutput({
        raw: '{"value":1,"candidateStage":"safety\\u005fstop",',
        schema,
        schemaDescription: "strict object with string value",
        repairer,
        repairPolicy: {
          preserve: preserveStructuredFields(["candidateStage"])
        },
        signal: new AbortController().signal
      })
    ).rejects.toBeInstanceOf(InvalidModelOutputError);
    expect(calls).toBe(0);
  });

  it("rejects repair that invents dialogue or evidence", async () => {
    const contentSchema = z
      .object({
        value: z.string(),
        dialogue: z.string().optional(),
        evidenceQuote: z.string().optional()
      })
      .strict();
    const repairer: JsonRepairer = {
      async repairJson() {
        return {
          value: "fixed",
          dialogue: "invented dialogue",
          evidenceQuote: "invented evidence"
        };
      }
    };

    await expect(
      parseProviderOutput({
        raw: { value: 1 },
        schema: contentSchema,
        schemaDescription: "content object",
        repairer,
        repairPolicy: {
          preserve: preserveStructuredFields([
            "dialogue",
            "evidenceQuote"
          ])
        },
        signal: new AbortController().signal
      })
    ).rejects.toBeInstanceOf(InvalidModelOutputError);
  });
});

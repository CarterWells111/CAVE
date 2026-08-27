import { z } from "zod";

import {
  buildDebriefDataSection,
  buildDebriefResponseContract
} from "../prompts/debrief";
import {
  buildTurnDataSection,
  buildTurnResponseContract
} from "../prompts/scenario";
import type { JsonRepairer, ProviderRepairInput } from "./repair";
import {
  abortError,
  assertNotAborted,
  ProviderError,
  type ModelProvider,
  type ProviderDebriefInput,
  type ProviderTurnInput
} from "./types";

export type ProviderLogEntry = {
  status: number | "network_error" | "timeout";
  latencyMs: number;
};

export const MAX_COMPLETION_BODY_BYTES = 64 * 1024;

type OpenAICompatibleProviderOptions = {
  baseUrl: string;
  apiKey: string;
  modelName: string;
  fetch?: typeof fetch;
  logger?: (entry: ProviderLogEntry) => unknown;
  sleep?: (milliseconds: number) => Promise<void>;
  timeoutMs?: number;
};

const ChatCompletionSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            message: z
              .object({
                content: z.string()
              })
              .passthrough()
          })
          .passthrough()
      )
      .min(1)
  })
  .passthrough();

async function cancelReader(
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // Cancellation is best-effort; callers still receive a body-free typed error.
  }
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const contentLength = Number(response.headers.get("Content-Length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_COMPLETION_BODY_BYTES
  ) {
    try {
      await response.body?.cancel();
    } catch {
      // Cancellation is best-effort.
    }
    throw new ProviderError("invalid_response", { status: response.status });
  }

  if (!response.body) {
    throw new ProviderError("invalid_response", { status: response.status });
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      totalBytes += next.value.byteLength;
      if (totalBytes > MAX_COMPLETION_BODY_BYTES) {
        await cancelReader(reader);
        throw new ProviderError("invalid_response", { status: response.status });
      }
      chunks.push(next.value);
    }
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    await cancelReader(reader);
    throw new ProviderError("invalid_response", { status: response.status });
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes)
    ) as unknown;
  } catch {
    throw new ProviderError("invalid_response", { status: response.status });
  }
}

const RETRYABLE_STATUS = (status: number) =>
  status === 408 || status === 429 || status >= 500;

function retryAfterMilliseconds(response: Response): number {
  const header = response.headers.get("Retry-After");
  if (!header) return 0;
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.min(seconds * 1000, 5000);
}

function decodeAssistantContent(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return content;
  }
}

export class OpenAICompatibleProvider implements ModelProvider, JsonRepairer {
  readonly #baseUrl: string;
  readonly #apiKey: string;
  readonly #modelName: string;
  readonly #fetch: typeof fetch;
  readonly #logger?: ((entry: ProviderLogEntry) => unknown) | undefined;
  readonly #sleep: (milliseconds: number) => Promise<void>;
  readonly #timeoutMs: number;

  constructor(options: OpenAICompatibleProviderOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.#apiKey = options.apiKey;
    this.#modelName = options.modelName;
    this.#fetch = options.fetch ?? fetch;
    this.#logger = options.logger;
    this.#sleep =
      options.sleep ??
      ((milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.#timeoutMs = options.timeoutMs ?? 15_000;
  }

  #log(entry: ProviderLogEntry): void {
    try {
      const outcome = this.#logger?.(entry);
      if (outcome !== undefined) {
        void Promise.resolve(outcome).catch(() => undefined);
      }
    } catch {
      // Observability must never affect provider delivery or retry semantics.
    }
  }

  async generateTurn(
    input: ProviderTurnInput,
    signal: AbortSignal
  ): Promise<unknown> {
    return await this.#complete(
      [
        {
          role: "system",
          content: [
            input.systemPrompt,
            buildTurnResponseContract(input.requestId)
          ].join("\n")
        },
        {
          role: "user",
          content: [
            input.scenarioPrompt,
            buildTurnDataSection({
              selectedOptions: input.selectedOptions,
              recentTurns: input.recentTurns,
              userMessage: input.userMessage
            })
          ].join("\n")
        }
      ],
      signal
    );
  }

  async generateDebrief(
    input: ProviderDebriefInput,
    signal: AbortSignal
  ): Promise<unknown> {
    return await this.#complete(
      [
        {
          role: "system",
          content: [
            input.systemPrompt,
            buildDebriefResponseContract(input.requestId)
          ].join("\n")
        },
        {
          role: "user",
          content: [input.debriefPrompt, buildDebriefDataSection(input.turns)].join(
            "\n"
          )
        }
      ],
      signal
    );
  }

  async repairJson(
    input: ProviderRepairInput,
    signal: AbortSignal
  ): Promise<unknown> {
    return await this.#complete(
      [
        {
          role: "system",
          content:
            "Repair one JSON value to the target schema. Do not add dialogue or evidence. Return JSON only."
        },
        {
          role: "user",
          content: JSON.stringify({
            invalidJson: input.invalidJson,
            targetSchemaDescription: input.targetSchemaDescription
          })
        }
      ],
      signal
    );
  }

  async #complete(
    messages: Array<{ role: "system" | "user"; content: string }>,
    externalSignal: AbortSignal
  ): Promise<unknown> {
    assertNotAborted(externalSignal);
    const controller = new AbortController();
    let timedOut = false;
    const operationStartedAt = Date.now();
    const onExternalAbort = () => controller.abort(abortError());
    externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(abortError());
    }, this.#timeoutMs);

    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const attemptStartedAt = Date.now();
        try {
        const response = await this.#fetch(`${this.#baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.#apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: this.#modelName,
            messages,
            stream: false,
            temperature: 0.3
          }),
          signal: controller.signal
        });
        this.#log({
          status: response.status,
          latencyMs: Date.now() - attemptStartedAt
        });

        if (!response.ok) {
          const wait = retryAfterMilliseconds(response);
          if (attempt === 0 && RETRYABLE_STATUS(response.status)) {
            if (wait > 0) await this.#interruptibleSleep(wait, controller.signal);
            continue;
          }
          throw new ProviderError(
            response.status === 429 ? "rate_limited" : "unavailable",
            {
              status: response.status,
              ...(wait > 0 ? { retryAfterSeconds: Math.ceil(wait / 1000) } : {})
            }
          );
        }

        const body = await readBoundedJson(response);
        const parsed = ChatCompletionSchema.safeParse(body);
        if (!parsed.success) {
          throw new ProviderError("invalid_response", { status: response.status });
        }
        const content = parsed.data.choices[0]?.message.content;
        if (content === undefined) {
          throw new ProviderError("invalid_response", { status: response.status });
        }
        return decodeAssistantContent(content);
        } catch (error) {
          if (externalSignal.aborted) throw abortError();
          if (timedOut) {
            this.#log({
              status: "timeout",
              latencyMs: Date.now() - operationStartedAt
            });
            throw new ProviderError("timeout");
          }
          if (error instanceof ProviderError) throw error;

          this.#log({
            status: "network_error",
            latencyMs: Date.now() - attemptStartedAt
          });
          if (attempt === 0) continue;
          throw new ProviderError("unavailable");
        }
      }
      throw new ProviderError("unavailable");
    } finally {
      clearTimeout(timeout);
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }

  async #interruptibleSleep(
    milliseconds: number,
    signal: AbortSignal
  ): Promise<void> {
    assertNotAborted(signal);
    let onAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(abortError());
      signal.addEventListener("abort", onAbort, { once: true });
    });
    try {
      await Promise.race([this.#sleep(milliseconds), aborted]);
    } finally {
      if (onAbort) signal.removeEventListener("abort", onAbort);
    }
  }
}

export type RequestMetricInput = {
  input: string;
  output: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

export type RequestMetrics = {
  inputChars: number;
  outputChars: number;
  inputTokens: number;
  outputTokens: number;
};

export function recordRequestMetrics({ input, output, usage }: RequestMetricInput): RequestMetrics {
  return {
    inputChars: input.length,
    outputChars: output.length,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0
  };
}

import type { AssistantResponse } from "@cave/contracts";

/** Strip presentation syntax only. Keep the answer's substance, uncertainty and safety information. */
export function growthReviewPlainText(value: string): string {
  const plain = value.replace(/\r\n?/gu, "\n")
    .replace(/^[ \t]*(?:`{3,}|~{3,})(?:[A-Za-z0-9_-]+)?[ \t]*$/gmu, "")
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gmu, "")
    .replace(/^[ \t]*(?:(?:[-+*]|\d+[.)、])[ \t]+)?\[[xX]\][ \t]+/gmu, "已勾选：")
    .replace(/^[ \t]*(?:(?:[-+*]|\d+[.)、])[ \t]+)?\[ \][ \t]+/gmu, "未勾选：")
    .replace(/^[ \t]*(?:[-+*]|\d+[.)、])[ \t]+/gmu, "")
    .replace(/^[ \t]*>[ \t]*(?=\p{Letter})/gmu, "")
    .replace(/!\[([^\]\n]*)\]\(([^)\n]+)\)/gu, "$1（$2）")
    .replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/gu, "$1（$2）")
    .replace(/\*\*([^*\n]+)\*\*/gu, "$1")
    .replace(/__([^_\n]+)__/gu, "$1")
    .replace(/~~([^~\n]+)~~/gu, "$1")
    .replace(/(^|[\s（(])_([^\s_\n](?:[^_\n]*[^\s_\n])?)_(?=$|[\s，。！？；：,.:;!?）)])/gmu, "$1$2")
    .replace(/(^|[\s（(])\*([^\s*\n](?:[^*\n]*[^\s*\n])?)\*(?=$|[\s，。！？；：,.:;!?）)])/gmu, "$1$2")
    .replace(/`([^`\n]+)`/gu, "$1")
    .replace(/^[ \t]*(?:-{3,}|={3,})[ \t]*$/gmu, "")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n").trim();
  return plain || value.trim();
}

export function normalizeGrowthReviewResponse(response: AssistantResponse): AssistantResponse {
  return {
    ...response,
    message: growthReviewPlainText(response.message),
    ...(response.question ? { question: growthReviewPlainText(response.question) } : {}),
    ...(response.summary ? { summary: growthReviewPlainText(response.summary) } : {}),
    observations: response.observations.map(observation => ({ ...observation, text: growthReviewPlainText(observation.text) })),
  };
}

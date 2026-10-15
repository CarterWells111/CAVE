import type { JournalService } from "../journal/application/journal-service";
import { journalDateFromDate, normalizeJournalDate } from "../journal/domain/journal-date";
import { journalTopicLabel, type JournalEntry, type JournalRecord } from "../journal/domain/journal-record";
import type { JournalRecordSummary } from "../journal/infrastructure/journal-repository";

export type AssistantQuestionContext = {
  records: { id: string; text: string }[];
  journeyId?: string;
};

type QuestionContextInput = Readonly<{
  question: string;
  journeyId?: string;
  journal?: Pick<JournalService, "listRecords" | "loadRecord">;
  signal?: AbortSignal;
  now?: Date;
}>;

const MAX_RECORDS = 3;
const MAX_RECORD_LENGTH = 4_000;
const MAX_CONTEXT_LENGTH = 12_000;
const JOURNAL_REFERENCE = /日记|手记|记录|diar(?:y|ies)|journals?/iu;
const JOURNEY_REFERENCE = /旅程|练习|过夜|内容知识|journey|exercise|overnight/iu;
const QUERY_BOILERPLATE = /帮我|请你|请帮|给我|可以|能否|一下|分析|总结|回顾|整理|查看|看看|读取|打开|告诉|有什么变化|相关|关于|有关|内容|日记|手记|记录|今天|昨天|最近|最新|写一篇|写一|写个|写下|怎么|如何|什么|为什么|这个|那个|我的|我在|我想|让我|的|了|吗|呢/gu;
const ENGLISH_STOP_WORDS = new Set([
  "a", "an", "and", "are", "can", "could", "diary", "diaries", "do", "for", "from",
  "help", "how", "i", "in", "is", "it", "journal", "journals", "latest", "me", "my",
  "of", "on", "please", "recent", "recently", "review", "show", "summarize", "the",
  "this", "to", "today", "was", "what", "with", "write", "yesterday",
]);

function checkAbort(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const error = new Error("assistant-context-aborted");
  error.name = "AbortError";
  throw error;
}

function isNewJournalPrompt(question: string): boolean {
  const writing = /(?:写|新建|创建|新增)[^。！？\n]{0,60}(?:日记|手记)/u.test(question);
  const existing = /(?:总结|回顾|根据|基于|参考|已有|现有|以前|之前|过去|旧)[^。！？\n]{0,24}(?:日记|手记|记录)|(?:日记|手记)[^。！？\n]{0,24}(?:总结|回顾|改写|重写|再写)/u.test(question);
  return writing && !existing;
}

function queryKeywords(question: string): string[] {
  const normalized = question.normalize("NFKC").toLowerCase().replace(QUERY_BOILERPLATE, " ");
  const keywords = new Set<string>();
  for (const segment of normalized.match(/[\p{Script=Han}]+|[a-z][a-z'-]+/gu) ?? []) {
    if (/^[a-z]/u.test(segment)) {
      if (!ENGLISH_STOP_WORDS.has(segment)) keywords.add(segment);
      continue;
    }
    const characters = Array.from(segment);
    for (let index = 0; index + 1 < characters.length; index += 1) {
      keywords.add(characters[index]! + characters[index + 1]!);
    }
  }
  return [...keywords];
}

function relevance(summary: JournalRecordSummary, keywords: readonly string[]): number {
  const title = summary.title.normalize("NFKC").toLowerCase();
  const highlight = summary.highlight.text.normalize("NFKC").toLowerCase();
  const topics = summary.topics.map(journalTopicLabel).join(" ").normalize("NFKC").toLowerCase();
  return keywords.reduce((score, keyword) => score
    + (title.includes(keyword) ? 3 : 0)
    + (highlight.includes(keyword) ? 2 : 0)
    + (topics.includes(keyword) ? 2 : 0), 0);
}

function requestedJournalDate(question: string, now: Date): string | undefined {
  if (!JOURNAL_REFERENCE.test(question)) return undefined;
  const date = new Date(now);
  if (/昨天|yesterday/iu.test(question)) date.setDate(date.getDate() - 1);
  else if (!/今天|today/iu.test(question)) return undefined;
  return journalDateFromDate(date);
}

function selectSummaries(summaries: readonly JournalRecordSummary[], question: string, now: Date): JournalRecordSummary[] {
  const keywords = queryKeywords(question);
  const date = requestedJournalDate(question, now);
  const recent = JOURNAL_REFERENCE.test(question) && /最近|最新|recent|latest/iu.test(question);
  const seen = new Set<string>();
  return summaries
    .filter((summary) => {
      if (seen.has(summary.id)) return false;
      seen.add(summary.id);
      return date === undefined || normalizeJournalDate(summary.occurredAt) === date;
    })
    .map((summary) => ({ summary, score: relevance(summary, keywords) }))
    .filter(({ score }) => score > 0 || (keywords.length === 0 && (date !== undefined || recent)))
    .sort((left, right) => (recent ? normalizeJournalDate(right.summary.occurredAt).localeCompare(normalizeJournalDate(left.summary.occurredAt)) : 0)
      || right.score - left.score
      || normalizeJournalDate(right.summary.occurredAt).localeCompare(normalizeJournalDate(left.summary.occurredAt))
      || right.summary.createdAt.localeCompare(left.summary.createdAt))
    .slice(0, MAX_RECORDS)
    .map(({ summary }) => summary);
}

function recordText(record: JournalRecord, entries: readonly JournalEntry[]): string {
  // Keep source references and card snapshots private; only selected journal prose is included.
  const parts = [
    `日期：${record.occurredAt}`,
    `标题：${record.title}`,
    `摘要：${record.highlight.text}`,
    `主题：${record.topics.map(journalTopicLabel).join("、")}`,
    `正文：${record.body}`,
    ...entries.map((entry) => [
      `补充（${entry.occurredAt}）：${entry.body}`,
      entry.highlight ? `摘要：${entry.highlight.text}` : "",
    ].filter(Boolean).join("\n")),
  ];
  return parts.join("\n").slice(0, MAX_RECORD_LENGTH);
}

/** Called only after the current app session has granted access to question-related private content. */
export async function collectAssistantQuestionContext(input: QuestionContextInput): Promise<AssistantQuestionContext> {
  const { question, journal, signal } = input;
  checkAbort(signal);
  const journeyId = input.journeyId?.trim();
  const context: AssistantQuestionContext = {
    records: [],
    ...(journeyId && JOURNEY_REFERENCE.test(question) ? { journeyId } : {}),
  };
  if (!journal || !question.trim() || isNewJournalPrompt(question)) return context;
  const summaries = await journal.listRecords();
  checkAbort(signal);
  const selected = selectSummaries(summaries, question, input.now ?? new Date());
  let remaining = MAX_CONTEXT_LENGTH;
  for (const summary of selected) {
    checkAbort(signal);
    const loaded = await journal.loadRecord(summary.id);
    checkAbort(signal);
    // A record may have been deleted after listing; it contributes no context.
    if (!loaded) continue;
    const text = recordText(loaded.record, loaded.entries).slice(0, remaining);
    if (text) context.records.push({ id: loaded.record.id, text });
    remaining -= text.length;
    if (remaining <= 0) break;
  }
  return context;
}

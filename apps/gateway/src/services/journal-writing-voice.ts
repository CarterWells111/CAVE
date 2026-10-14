export const JOURNAL_WRITING_VOICE_RULE = "Write savable journal bodies, summaries and review observations in the user's own first-person voice (我/我们), preserving only supplied facts and uncertainty. Do not address the user as 你/您, speak as an AI, or add explanations, introductions, notes or footnotes. Preserve genuine attributed quotations and dialogue from supplied original records or user statements; quoted speakers may still say 你. Never turn an assistant example into something that happened. A new title can be a natural short phrase without 我, but must not address the user or explain AI work. Existing edit titles must stay exactly as supplied.";
export const JOURNAL_VOICE_RETRY_RULE = "上一次可保存文字的口吻不符合要求。请仅纠正口吻：用用户自己的第一人称我/我们记录，不对用户说你/您，不添加AI解释、前后说明、注释或脚注。保留已有事实、不确定性和真实引语，不把他人的经历改成用户经历，不擅改逐字保留的原文。保持原输出格式、阶段、请求标识、标题及日期约束。";
type Sources = Readonly<{ records?: readonly Readonly<{ id: string; text: string }>[]; userTexts?: readonly string[] }>;
type VoiceResult = { ok: true } | { ok: false; reason: "missing_first_person" | "second_person" | "ai_commentary" };
const object = (value: unknown): Record<string, unknown> | undefined => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;

function statements(sources: Sources): string[] {
  const result = [...(sources.userTexts ?? [])];
  const add = (value: unknown) => { if (typeof value === "string") result.push(value); };
  for (const record of sources.records ?? []) {
    // A pending AI draft is not independent evidence for a newly invented quote.
    if (/^journal-review-current-draft(?:\.context)?$/u.test(record.id)) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(record.text) as unknown; } catch { result.push(record.text); continue; }
    const item = object(parsed);
    if (item?.referenceType === "journal-review-context") {
      if (Array.isArray(item.recentConversation)) for (const turn of item.recentConversation) add(object(turn)?.user);
      continue;
    }
    if (item && typeof item.body === "string") {
      add(item.title); add(item.body); add(object(item.highlight)?.text);
      if (Array.isArray(item.entries)) for (const entry of item.entries) {
        const addition = object(entry); add(addition?.body); add(object(addition?.highlight)?.text);
      }
    } else if (typeof parsed === "string") add(parsed);
  }
  return result;
}

/** A conservative style check, not a rewrite or a factual inference engine. */
export function checkJournalWritingVoice(text: string, sources: Sources = {}, requireFirstPerson = true): VoiceResult {
  const originals = statements(sources);
  const quotes = /“([^“”]*)”|‘([^‘’]*)’|「([^「」]*)」|『([^『』]*)』|"([^"\n]*)"|'([^'\n]*)'/gu;
  let outside = ""; let cursor = 0;
  for (const match of text.matchAll(quotes)) {
    const content = match.slice(1).find(value => value !== undefined) ?? "";
    const before = text.slice(Math.max(0, match.index - 60), match.index);
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 40);
    const attributed = /(?:说|问|告诉|回答|回复|提醒|写道|转述|读到|看到|想起|记得|心想|自语)[^。！？\n]{0,30}[：:,，]?\s*$/u.test(before)
      || /^\s*[，,。]?\s*[^。！？\n]{0,20}(?:说|问|回答|回复|写道)/u.test(after);
    if (content && attributed && originals.some(original => original.includes(content))) {
      outside += text.slice(cursor, match.index) + " ".repeat(match[0].length);
      cursor = match.index + match[0].length;
    }
  }
  outside += text.slice(cursor);
  if (/(?:作为|我是)(?:一个|一名)?(?:AI|人工智能|智能助手)|我(?:为你|帮你|替你)|(?:以下|下面|下方)(?:是|为).{0,30}(?:草稿|手记|正文|优化|改写|回顾|版本)|(?:根据|基于|依据)(?:以上|上述|所给|提供的)(?:资料|信息|内容|记录)|(?:^|[\n（(])\s*(?:注|注释|备注|说明|脚注|编者按|AI\s*说明|(?:优化|改写|润色)(?:后的?)?(?:手记|正文|内容|版本)(?:如下)?)\s*[:：]|\[\^[^\]]+\]|\[\d+\]/iu.test(outside))
    return { ok: false, reason: "ai_commentary" };
  if (/[你您]/u.test(outside)) return { ok: false, reason: "second_person" };
  if (requireFirstPerson && !/(?<!自|忘|小|大)我/u.test(outside)) return { ok: false, reason: "missing_first_person" };
  return { ok: true };
}

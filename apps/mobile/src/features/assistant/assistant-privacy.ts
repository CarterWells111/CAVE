import type { AssistantRequest } from "@cave/contracts";
// Conservative local eligibility, not a promise to recognize every private fact.
// Unknown topics still ask; no content is uploaded to classify its own privacy.
const IDENTIFYING = /(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/|(?:\+?\d[\d\s()-]{6,}\d)|身份证|护照|地址|住址|密码|验证码|银行卡|账户|手机号|电话|病历|诊断|药物|性生活|性经历|自杀|自残|家暴|性侵|伴侣|男朋友|女朋友|老公|老婆|\b(?:password|address|diagnosis)\b)/iu;
const PERSONAL = /(?:我的|我们|我和|我在|我有|我被|我觉得|我感觉|今天我|昨天我|\b(?:my|our|i am|i have|i feel|i was)\b)/iu;
const PUBLIC_QUESTION = /^(?:(?:请|可以|能不能|你能|帮我|给我|为我)[，,：:\s]*)*(?:讲解|介绍|解释|科普|聊聊|说说|什么是|什么叫)(?:一下)?(?:彩虹|光合作用|太阳系|月亮|星星|四季|地球|海洋|音乐|绘画|电影|文学|诗歌|人工智能|数学|历史)(?:的原理|是什么|的基本知识)?[！!。.?？\s]*$/u;
const PUBLIC_SMALL_TALK = /^(?:你好|您好|嗨|早上好|晚上好|谢谢(?:你)?|好的|好呀|好啊|继续|接着说|再讲一个|(?:请)?讲个笑话|hello|hi|thanks|thank you)[！!。.?？\s]*$/iu;
const PUBLIC_STARTERS = new Set([
  "我想写一篇今天的日记，请从一个简单的问题开始，带我慢慢记录。",
  "我想整理一下此刻的感受，请先问我一个温和、容易回答的问题。",
]);
function clearlyPublic(text: string): boolean {
  const value = text.normalize("NFKC").trim();
  if (IDENTIFYING.test(value) || PERSONAL.test(value)) return false;
  return PUBLIC_STARTERS.has(value) || PUBLIC_SMALL_TALK.test(value) || PUBLIC_QUESTION.test(value);
}
export function needsPrivateConfirmation(input: AssistantRequest): boolean {
  if (input.mode !== "chat" || input.records.length > 0 || !input.question) return true;
  if (!clearlyPublic(input.question)) return true;
  return (input.history ?? []).some(message => message.role === "user" ? !clearlyPublic(message.content) : IDENTIFYING.test(message.content));
}

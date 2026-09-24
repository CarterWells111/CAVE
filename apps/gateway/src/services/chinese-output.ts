export const CHINESE_RETRY_RULE = "上一次回答未满足语言要求。请重新回答：所有给用户看的文字必须使用简体中文；不要使用英文句子，不要照搬输入中的英文表达。保留原有的安全要求和输出格式。";

// Allow short names and common abbreviations inside Chinese prose, but reject
// an English answer with a token Chinese phrase added to it.
export function isChineseProse(text: string): boolean {
  const han = (text.match(/\p{Script=Han}/gu) ?? []).length;
  const latin = (text.match(/[A-Za-z]/gu) ?? []).length;
  return han > 0 && latin <= han * 1.5;
}

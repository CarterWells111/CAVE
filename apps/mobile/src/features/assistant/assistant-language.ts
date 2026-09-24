// Keep this in sync with the gateway's response check. The client also guards
// responses from an older deployed gateway before displaying them.
export function isChineseProse(text: string): boolean {
  const han = (text.match(/\p{Script=Han}/gu) ?? []).length;
  const latin = (text.match(/[A-Za-z]/gu) ?? []).length;
  return han > 0 && latin <= han * 1.5;
}

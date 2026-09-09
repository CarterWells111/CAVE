import type { AssistantRequest } from "@cave/contracts";
import { needsPrivateConfirmation } from "./assistant-privacy";
const input: AssistantRequest = { mode: "chat", consent: true, records: [], question: "你好" };
test.each(["你好", "谢谢", "什么是彩虹？", "请讲个笑话", "解释一下光合作用"])("allows public conversation locally: %s", question => {
  expect(needsPrivateConfirmation({ ...input, question })).toBe(false);
});
test.each(["我的邮箱是 a@example.com", "电话 13800138000", "我感觉很难过", "什么是我的病历", "这里有一段无法判断的内容", "如何告诉伴侣我的性经历"])("keeps confirmation for private or uncertain content: %s", question => {
  expect(needsPrivateConfirmation({ ...input, question })).toBe(true);
});
test("includes history and selected records in the decision", () => {
  expect(needsPrivateConfirmation({ ...input, history: [{ role: "user", content: "我被欺负了" }] })).toBe(true);
  expect(needsPrivateConfirmation({ ...input, history: [{ role: "assistant", content: "你的地址是 123456789" }] })).toBe(true);
  expect(needsPrivateConfirmation({ ...input, records: [{ id: "a", text: "日记" }] })).toBe(true);
});

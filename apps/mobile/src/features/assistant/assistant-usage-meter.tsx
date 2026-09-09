import type { AssistantUsage } from "@cave/contracts";
import { useCallback, useEffect, useState } from "react";
import { AppState, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../../core/design/theme-provider";
import { SecondaryButton } from "../../core/ui/secondary-button";
import { getGatewayUrl } from "../../config/gateway";
import { useOptionalAuth } from "../auth/runtime/AuthProvider";
import { fetchAssistantUsage } from "./assistant-client";

export const usagePercent = (used: number, limit: number | null) => limit === null ? null : Math.min(100, Math.round(used / limit * 100));
export function AssistantUsageMeter({ revision, preview, loadUsage }: { revision: number; preview: boolean; loadUsage?: (signal: AbortSignal) => Promise<AssistantUsage> }) {
  const theme = useTheme();
  const auth = useOptionalAuth();
  const [open, setOpen] = useState(false);
  const [usage, setUsage] = useState<AssistantUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const accountId = auth?.accountId;
  const getToken = auth?.getAssistantAccessToken;
  const reload = useCallback(() => setRefresh(value => value + 1), []);
  useEffect(() => {
    if (preview || (!loadUsage && (!accountId || !getToken))) { setUsage(null); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let active = true;
    setLoading(true); setFailed(false);
    const promise = loadUsage ? loadUsage(controller.signal) : fetchAssistantUsage({ baseUrl: getGatewayUrl(), getAccessToken: () => getToken!(accountId!), signal: controller.signal });
    void promise.then(value => { if (active) setUsage(value); }).catch(() => { if (active) { setUsage(null); setFailed(true); } }).finally(() => { clearTimeout(timer); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [accountId, getToken, preview, loadUsage, revision, refresh]);
  useEffect(() => {
    if (preview || !accountId) return;
    const subscription = AppState.addEventListener("change", state => { if (state === "active") reload(); });
    const timer = setInterval(reload, 60000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, [preview, accountId, reload]);
  const percentages = usage ? [usagePercent(usage.hour.used, usage.hour.limit), usagePercent(usage.day.used, usage.day.limit)].filter((value): value is number => value !== null) : [];
  const percent = percentages.length ? Math.max(...percentages) : null;
  const color = percent === null ? theme.color.textSecondary : percent >= 100 ? theme.color.danger : theme.color.primary;
  const subtitle = preview ? "模拟模式，不消耗云端额度" : !accountId && !loadUsage ? "登录后查看用量" : loading ? "正在更新用量" : failed ? "暂时无法获取用量" : percent === null ? "额度待设置" : `已使用 ${percent}%`;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`查看 AI 用量，${subtitle}`} onPress={() => { setOpen(true); reload(); }} style={{ minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" }}>
      <View testID="usage-gauge" style={{ width: 32, height: 19, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 3, borderBottomWidth: 0, borderColor: color, overflow: "hidden" }}>
        <View style={{ position: "absolute", bottom: -12, left: 12, height: 26, width: 2, transform: [{ rotate: `${-85 + (percent ?? 0) * 1.7}deg` }] }}><View style={{ height: 14, width: 2, backgroundColor: color }} /></View>
      </View>
      <Text style={{ fontSize: 10, lineHeight: 14, color }}>{percent === null ? "—" : `${percent}%`}</Text>
    </Pressable>
    <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#00000099" }}>
        <View accessibilityViewIsModal style={{ width: "100%", maxWidth: 520, maxHeight: "85%", alignSelf: "center", borderRadius: 24, padding: 24, gap: 20, backgroundColor: theme.color.surface }}>
          <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text }}>给聊天留一点余量</Text>
          <ScrollView contentContainerStyle={{ gap: 20 }}>
            <Text accessibilityLiveRegion="polite" style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>{subtitle}</Text>
            {usage && (["hour", "day"] as const).map(key => {
              const window = usage[key]; const value = usagePercent(window.used, window.limit);
              return <View key={key} style={{ gap: 8 }}>
                <Text style={{ ...theme.typography.body, color: theme.color.text }}>{key === "hour" ? "每小时" : "每天"} · {value === null ? "额度待设置" : `${value}%`}</Text>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.color.border }}><View style={{ height: 6, width: `${value ?? 0}%`, borderRadius: 3, backgroundColor: value === 100 ? theme.color.danger : theme.color.primary }} /></View>
                <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>已用 {window.used} 次{window.limit === null ? "" : ` / ${window.limit} 次`} · {new Date(window.resetsAt).toLocaleString()} 重置</Text>
              </View>;
            })}
            <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>按账号统计，多个设备共用。每次确认后进入云端 AI 处理计 1 次；处理开始后的失败或停止等待也会计入。取消发送和本机模拟不计入。按 UTC 整点与零点重置，上方时间显示为你的本地时间。</Text>
          </ScrollView>
          {failed ? <SecondaryButton label="重新获取用量" onPress={reload} /> : null}
          <SecondaryButton label="知道了，继续聊" onPress={() => setOpen(false)} />
        </View>
      </View>
    </Modal>
  </>;
}

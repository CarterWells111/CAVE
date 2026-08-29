import { Alert, Linking } from "react-native";

export const JOURNEY_SOURCES_URL = "https://neijiecave.com/sources/";

export function openJourneySources(): Promise<void> {
  return Linking.openURL(JOURNEY_SOURCES_URL).then(() => undefined).catch(() => {
    Alert.alert("无法打开信息来源", "请检查网络连接后重试。", [
      { text: "取消", style: "cancel" },
      { text: "重试", onPress: () => { void openJourneySources(); } },
    ]);
  });
}

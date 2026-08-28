import type { JourneySource } from "@cave/content";
import { Alert, Linking } from "react-native";

export function openJourneySources(
  availableSources: JourneySource[],
  sourceIds: string[],
): Promise<void> {
  const requestedIds = new Set(sourceIds);
  const sources = availableSources.filter(({ id }) => requestedIds.has(id));
  if (sources.length === 0) return Promise.resolve();

  return new Promise<void>((resolve) => {
    Alert.alert("信息来源", "请选择要查看的来源。", [
      ...sources.map((source) => ({
        text: source.organization,
        onPress: () => {
          void Linking.openURL(source.url).catch(() => undefined).finally(resolve);
        },
      })),
      { text: "取消", style: "cancel" as const, onPress: () => resolve() },
    ]);
  });
}

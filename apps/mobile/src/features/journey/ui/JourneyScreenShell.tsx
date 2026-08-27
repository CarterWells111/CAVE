import type { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { JOURNEY_PAGE_IDS } from "../application/journey-navigation";
import type { JourneyPageId } from "../domain/types";

type Props = PropsWithChildren<{
  pageId: JourneyPageId;
  onBack?: () => void;
}>;

export function JourneyScreenShell({ pageId, onBack, children }: Props) {
  const pageNumber = JOURNEY_PAGE_IDS.indexOf(pageId) + 1;
  return (
    <View style={styles.screen} testID={`journey-page-${pageId}`}>
      <Text style={styles.progress}>{`第 ${pageNumber} 页，共 8 页`}</Text>
      {pageNumber > 1 ? (
        <Pressable accessibilityRole="button" onPress={onBack} testID="journey-back">
          <Text>返回修改</Text>
        </Pressable>
      ) : null}
      <Text style={styles.title}>{pageId}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: 16, padding: 24 },
  progress: { fontSize: 14 },
  title: { fontSize: 24, fontWeight: "600" }
});

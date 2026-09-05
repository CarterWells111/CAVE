import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useWindowDimensions } from "react-native";

import { Screen } from "../../src/core/ui/Screen";
import { getResumePath } from "../../src/features/journey/application/journey-navigation";
import { useOptionalJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { resolveFirstRunLayout } from "../../src/features/journey/ui/first-run-layout";
import { WelcomePage } from "../../src/features/journey/ui/pages/WelcomePage";

import { onboardingHref, resolveJourneyEntry } from "../../src/features/shell/application/journey-entry";

export default function WelcomeRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ entry?: string }>();
  const entry = resolveJourneyEntry(params.entry);
  const { fontScale, height, width } = useWindowDimensions();
  const [viewport, setViewport] = useState<{ height: number; width: number } | null>(null);
  const layout = resolveFirstRunLayout({
    fontScale,
    height: viewport?.height ?? height,
    width: viewport?.width ?? width,
  });
  const runtime = useOptionalJourneyRuntime();
  const snapshot = runtime?.snapshot ?? null;
  const resumeAvailable = snapshot?.ageConfirmed === true;
  const resume = () => {
    if (snapshot === null || snapshot.addressPreference === null || !snapshot.prefaceRead) {
      router.replace(onboardingHref("/journey/preface", entry));
      return;
    }
    router.replace(entry === "first-overnight" ? getResumePath(snapshot) : "/(tabs)");
  };
  return (
    <Screen
      alwaysBounceVertical={false}
      contentContainerStyle={{ paddingVertical: layout.screenPaddingVertical }}
      contentSafeAreaTop
      onLayout={({ nativeEvent }) => setViewport({
        height: nativeEvent.layout.height,
        width: nativeEvent.layout.width,
      })}
      scrollEnabled={false}
      testID="journey-welcome-scroll"
    >
      <WelcomePage
        brandPaddingTop={layout.brandPaddingTop}
        layout={layout.brandLayout}
        onOpenSettings={() => router.push("/settings")}
        onResume={resume}
        onStart={() => router.push(onboardingHref("/journey/adult-gate", entry))}
        resumeAvailable={resumeAvailable}
      />
    </Screen>
  );
}

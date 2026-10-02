import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";

import { useTheme } from "../../src/core/design/theme-provider";
import { TextAction } from "../../src/core/ui/text-action";
import { Screen } from "../../src/core/ui/Screen";
import { useAccountProfile } from "../../src/features/account/runtime/AccountProfileProvider";
import { getResumePath } from "../../src/features/journey/application/journey-navigation";
import { type JourneyRuntimeContextValue, useOptionalJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { WelcomePage } from "../../src/features/journey/ui/pages/WelcomePage";
import { resolveFirstRunLayout } from "../../src/features/journey/ui/first-run-layout";
import { HomeScreen } from "../../src/features/shell/ui/HomeScreen";
import { useJourneyMapAccess } from "../../src/features/shell/ui/use-journey-map-access";

export default function HomeRoute() {
  const runtime = useOptionalJourneyRuntime();
  return runtime === null ? <FirstRunHomeRoute runtime={null} /> : <AuthorizedHomeRoute runtime={runtime} />;
}

function FirstRunHomeRoute({ runtime }: { runtime: JourneyRuntimeContextValue | null }) {
  const router = useRouter();
  const { fontScale, height, width } = useWindowDimensions();
  const [viewport, setViewport] = useState<{ height: number; width: number } | null>(null);
  const layout = resolveFirstRunLayout({
    fontScale,
    height: viewport?.height ?? height,
    width: viewport?.width ?? width,
  });
  const snapshot = runtime?.snapshot ?? null;
  const resumeAvailable = snapshot?.ageConfirmed === true;
  const resume = () => {
    if (snapshot === null || snapshot.addressPreference === null || !snapshot.prefaceRead) {
      router.push("/journey/preface");
      return;
    }
    router.push(getResumePath(snapshot));
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
      testID="first-run-home-scroll"
    >
      <WelcomePage
        brandPaddingTop={layout.brandPaddingTop}
        layout={layout.brandLayout}
        onOpenSettings={() => router.push("/settings")}
        onResume={resume}
        onStart={() => router.push("/journey/adult-gate")}
        resumeAvailable={resumeAvailable}
      />
    </Screen>
  );
}


function AuthorizedHomeRoute({ runtime }: { runtime: JourneyRuntimeContextValue }) {
  const theme = useTheme();
  const router = useRouter();
  const accountProfile = useAccountProfile();
  const access = useJourneyMapAccess(runtime);

  if (access.status === "onboarding") return <FirstRunHomeRoute runtime={runtime} />;

  const openScenario = () => router.push({ pathname: "/rooms/choose", params: { scenario: "first-overnight" } });

  return (
    <Screen contentSafeAreaTop testID="journey-map-scroll">
      <HomeScreen
        account={{
          status: accountProfile.status,
          ...(accountProfile.profile?.displayName === undefined ? {} : { displayName: accountProfile.profile.displayName }),
          onOpen: () => {
            router.push(accountProfile.status === "signedOut" ? "/auth/email" : "/(tabs)/profile");
          },
        }}
        loadState={access.status}
        onRetry={access.retry}
        onOpenSample={(id) => {
          router.push({ pathname: "/explore/[journeyId]", params: { journeyId: id } });
        }}
        onOpenScenario={openScenario}
      />
      <View style={{ gap: theme.space.sm }} testID="journey-map-tools">
        <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text }}>旅程工具</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm }}>
          <TextAction label="沟通练习" onPress={() => router.push("/(tabs)/practice")} />
          <TextAction label="问问 AI：第一次过夜" onPress={() => router.push({ pathname: "/(tabs)/ai", params: { journeyId: "first-overnight" } })} />
          <TextAction label="主题探索：身体感受" onPress={() => router.push("/reviews/topic/body")} />
          <TextAction label="主题探索：边界与表达" onPress={() => router.push("/reviews/topic/boundaries")} />
        </View>
      </View>
    </Screen>
  );
}

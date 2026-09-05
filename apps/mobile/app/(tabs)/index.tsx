import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";

import { Screen } from "../../src/core/ui/Screen";
import { useAccountProfile } from "../../src/features/account/runtime/AccountProfileProvider";
import { getResumePath } from "../../src/features/journey/application/journey-navigation";
import { type JourneyRuntimeContextValue, useOptionalJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { WelcomePage } from "../../src/features/journey/ui/pages/WelcomePage";
import { resolveFirstRunLayout } from "../../src/features/journey/ui/first-run-layout";
import { prepareFirstOvernight } from "../../src/features/shell/application/journey-entry";
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
  const router = useRouter();
  const accountProfile = useAccountProfile();
  const access = useJourneyMapAccess(runtime);
  const [scenarioPending, setScenarioPending] = useState(false);
  const [scenarioError, setScenarioError] = useState(false);
  const inFlight = useRef(false);
  const active = useRef(true);
  const navigationEpoch = useRef(0);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; navigationEpoch.current += 1; };
  }, [runtime.service]);
  useFocusEffect(useCallback(() => {
    // Tabs stay mounted after navigation; invalidate an opening request on blur.
    return () => { navigationEpoch.current += 1; };
  }, []));

  if (access.status === "onboarding") return <FirstRunHomeRoute runtime={runtime} />;

  const openScenario = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const epoch = ++navigationEpoch.current;
    setScenarioPending(true);
    setScenarioError(false);
    try {
      const destination = await prepareFirstOvernight(runtime);
      if (active.current && navigationEpoch.current === epoch) router.push(destination);
    } catch {
      if (active.current && navigationEpoch.current === epoch) setScenarioError(true);
    } finally {
      inFlight.current = false;
      if (active.current) setScenarioPending(false);
    }
  };

  return (
    <Screen contentSafeAreaTop testID="journey-map-scroll">
      <HomeScreen
        account={{
          status: accountProfile.status,
          ...(accountProfile.profile?.displayName === undefined ? {} : { displayName: accountProfile.profile.displayName }),
          onOpen: () => {
            navigationEpoch.current += 1;
            router.push(accountProfile.status === "signedOut" ? "/auth/email" : "/(tabs)/profile");
          },
        }}
        loadState={access.status}
        onRetry={access.retry}
        onOpenSample={(id) => {
          navigationEpoch.current += 1;
          router.push({ pathname: "/explore/[journeyId]", params: { journeyId: id } });
        }}
        onOpenScenario={openScenario}
        scenarioPending={scenarioPending}
        scenarioError={scenarioError}
      />
    </Screen>
  );
}

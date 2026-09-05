import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useOptionalAccountPreferences } from "../../src/features/account/runtime/AccountPreferencesProvider";
import { useOptionalAuth } from "../../src/features/auth/runtime/AuthProvider";

import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { JourneyGuidedScrollScreen } from "../../src/features/journey/ui/guided-scroll-screen";
import { PrefacePage } from "../../src/features/journey/ui/pages/preface-page";
import { PrefaceWelcomeSheet } from "../../src/features/journey/ui/pages/preface-welcome-sheet";

import { onboardingHref, resolveJourneyEntry } from "../../src/features/shell/application/journey-entry";
import { getResumePath } from "../../src/features/journey/application/journey-navigation";

export default function PrefaceRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ entry?: string }>();
  const entry = resolveJourneyEntry(params.entry);
  const runtime = useJourneyRuntime();
  const preferences = useOptionalAccountPreferences();
  const auth = useOptionalAuth();
  const eligible = runtime.snapshot?.ageConfirmed === true;
  const preference = runtime.snapshot?.addressPreference ?? null;
  const [choosing, setChoosing] = useState(preference === null);
  const prefaceRead = runtime.snapshot?.prefaceRead === true;
  const completed = eligible && preference !== null && prefaceRead && !choosing;
  const replacedDestination = useRef<string | null>(null);
  const destination = entry === "first-overnight" ? getResumePath(runtime.snapshot) : "/(tabs)";

  useEffect(() => {
    if (!eligible) {
      if (replacedDestination.current === "/journey/welcome") return;
      replacedDestination.current = "/journey/welcome";
      router.replace(onboardingHref("/journey/welcome", entry));
      return;
    }
    if (completed) {
      if (replacedDestination.current === destination) return;
      replacedDestination.current = destination;
      router.replace(destination);
      return;
    }
    replacedDestination.current = null;
  }, [completed, destination, eligible, entry, router]);

  if (!eligible || completed) return null;
  return (
    <JourneyGuidedScrollScreen resetKey="preface">
      {choosing || preference === null ? (
        <PrefacePage
          initialPreference={preferences?.preferences.addressPreference ?? preference}
          onChoose={preferences === null ? undefined : (addressPreference) => preferences.change({ addressPreference })}
          onSignIn={auth?.status === "signedOut" ? () => router.push({ pathname: "/auth/email", params: { returnTo: "/journey/preface", ...(entry === "first-overnight" ? { entry } : {}) } }) : undefined}
          onContinue={(selectedPreference) => runtime.runAndRefresh(async () => {
            if (prefaceRead) {
              await runtime.service.dispatch({ type: "set-preface-read", read: false });
            }
            await runtime.service.dispatch({
              type: "set-address-preference",
              preference: selectedPreference,
            });
            setChoosing(false);
          })}
        />
      ) : (
        <PrefaceWelcomeSheet
          actionLabel={entry === "map" ? "我已了解，选择旅程" : "我已了解，开始旅程"}
          onConfirm={() => runtime.runAndRefresh(() => (
            runtime.service.dispatch({ type: "set-preface-read", read: true })
          ))}
          preference={preference}
          visible
        />
      )}
    </JourneyGuidedScrollScreen>
  );
}

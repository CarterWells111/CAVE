import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { useOptionalAccountPreferences } from "../../src/features/account/runtime/AccountPreferencesProvider";

import { useAuth } from "../../src/features/auth/runtime/AuthProvider";
import { EmailAuthScreen } from "../../src/features/auth/ui/EmailAuthScreen";
import { useAdultDeclaration } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { backOrHome, journalReturnDestination } from "../../src/features/shell/ui/safe-navigation";

export default function EmailAuthRoute() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const auth = useAuth();
  const preferences = useOptionalAccountPreferences();
  const adult = useAdultDeclaration();
  const returned = useRef(false);
  useEffect(() => {
    if (returned.current || auth.status !== "signedIn") return;
    if (returnTo === "/(tabs)/profile") {
      returned.current = true;
      router.replace("/(tabs)/profile");
      return;
    }
    if (preferences === null || !preferences.ready) return;
    if (returnTo !== "/journey/adult-gate" && returnTo !== "/journey/preface") return;
    if (preferences.syncStatus === "pending" || preferences.syncStatus === "syncing") return;
    if (preferences.preferences.ageConfirmed && adult.status !== "authorized") return;
    returned.current = true;
    router.replace(preferences.preferences.ageConfirmed ? "/journey/preface" : "/journey/adult-gate");
  }, [adult.status, auth.status, preferences, returnTo, router]);
  return <EmailAuthScreen
    adultAuthorized={adult.status === "authorized"}
    onAdultGate={() => router.push("/journey/adult-gate")}
    onBack={() => backOrHome(router)}
    onDeleteAccount={() => router.push("/auth/delete-account")}
    onLogout={async () => { await auth.logout(); router.replace("/settings"); }}
    onRequestEmail={auth.requestEmailChallenge}
    onVerifyCode={async (challengeId, code, email) => {
      await auth.verifyEmailChallenge(challengeId, code, email);
      if (returned.current || returnTo === "/(tabs)/profile" || returnTo === "/journey/adult-gate" || returnTo === "/journey/preface") return;
      const destination = journalReturnDestination(returnTo);
      returned.current = true;
      router.replace(destination ?? "/(tabs)/profile");
    }}
    status={auth.status}
  />;
}

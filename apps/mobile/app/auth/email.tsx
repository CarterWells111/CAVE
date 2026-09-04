import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "../../src/features/auth/runtime/AuthProvider";
import { EmailAuthScreen } from "../../src/features/auth/ui/EmailAuthScreen";
import { useAdultDeclaration } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { backOrHome, journalReturnDestination } from "../../src/features/shell/ui/safe-navigation";

export default function EmailAuthRoute() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const auth = useAuth();
  const adult = useAdultDeclaration();
  return <EmailAuthScreen
    adultAuthorized={adult.status === "authorized"}
    onAdultGate={() => router.push("/journey/adult-gate")}
    onBack={() => backOrHome(router)}
    onDeleteAccount={() => router.push("/auth/delete-account")}
    onLogout={async () => { await auth.logout(); router.replace("/settings"); }}
    onRequestEmail={auth.requestEmailChallenge}
    onVerifyCode={async (challengeId, code, email) => {
      await auth.verifyEmailChallenge(challengeId, code, email);
      const destination = journalReturnDestination(returnTo);
      if (destination !== null) router.replace(destination);
    }}
    status={auth.status}
  />;
}

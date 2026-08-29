import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "../../src/features/auth/runtime/AuthProvider";
import { EmailAuthScreen } from "../../src/features/auth/ui/EmailAuthScreen";
import { useAdultDeclaration } from "../../src/features/journey/runtime/JourneyRuntimeProvider";

export default function EmailAuthRoute() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const auth = useAuth();
  const adult = useAdultDeclaration();
  return <EmailAuthScreen
    adultAuthorized={adult.status === "authorized"}
    onAdultGate={() => router.push("/journey/adult-gate")}
    onBack={() => router.back()}
    onDeleteAccount={() => router.push("/auth/delete-account")}
    onLogout={async () => { await auth.logout(); router.replace("/settings"); }}
    onRequestEmail={auth.requestEmailChallenge}
    onVerifyCode={async (challengeId, code, email) => {
      await auth.verifyEmailChallenge(challengeId, code, email);
      if (typeof returnTo === "string" && /^\/journal(?:\/|$)/u.test(returnTo)) {
        router.replace(returnTo as never);
      }
    }}
    status={auth.status}
  />;
}

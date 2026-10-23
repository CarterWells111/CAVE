import { useRouter, type Href } from "expo-router";

import { Screen } from "../src/core/ui/Screen";
import { useOptionalAuth } from "../src/features/auth/runtime/AuthProvider";
import { stageGrowthReviewEntry } from "../src/features/assistant/growth-review-entry";
import { GrowthReviewScreen } from "../src/features/growth/growth-review-screen";
import { backOrHome } from "../src/features/shell/ui/safe-navigation";
import { useGrowthRecords } from "../src/features/growth/use-growth-records";

export default function GrowthRoute() {
  const router = useRouter();
  const auth = useOptionalAuth();
  const growth = useGrowthRecords();
  const signIn = () => router.push({ pathname: "/auth/email", params: { returnTo: "/growth" } });
  return <Screen>
    <GrowthReviewScreen data={growth.data}
      state={growth.locked ? "locked" : growth.loading ? "loading" : growth.error ? "error" : "ready"}
      onBack={() => backOrHome(router)} onRetry={growth.reload} onSignIn={signIn}
      onOpenEvent={href => router.push(href as Href)}
      onAiReview={range => {
        if (!auth?.accountId) { signIn(); return; }
        stageGrowthReviewEntry(auth.accountId, range);
        router.push("/(tabs)/ai");
      }}
    />
  </Screen>;
}

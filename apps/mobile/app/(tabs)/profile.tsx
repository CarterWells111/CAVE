import { useRouter } from "expo-router";

import { Screen } from "../../src/core/ui/Screen";
import { useAccountProfile } from "../../src/features/account/runtime/AccountProfileProvider";
import { useGrowthRecords } from "../../src/features/growth/use-growth-records";
import { ProfileScreen } from "../../src/features/shell/ui/ProfileScreen";

export default function ProfileRoute() {
  const router = useRouter();
  const account = useAccountProfile();
  const growth = useGrowthRecords();
  return <Screen>
    <ProfileScreen account={{
      status: account.status,
      ...(account.email === undefined ? {} : { email: account.email }),
      ...(account.profile === undefined ? {} : { profile: account.profile }),
      ...(account.status === "signedOut" ? { onSignIn: () => router.push({ pathname: "/auth/email", params: { returnTo: "/(tabs)/profile" } }) } : {}),
      ...(account.status === "error" ? { onRetry: account.retry } : {}),
    }}
      growth={growth.data}
      growthState={growth.locked ? "locked" : growth.loading ? "loading" : growth.error ? "error" : "ready"}
      onRetryGrowth={growth.reload}
      onOpenSettings={() => router.push("/settings")}
      onOpenGrowth={() => router.push("/growth")}
    />
  </Screen>;
}

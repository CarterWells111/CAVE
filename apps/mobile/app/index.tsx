import Constants from "expo-constants";

import { HealthScreen } from "../src/features/health/health-screen";

type RuntimeExtra = {
  build?: string;
  environment?: string;
};

export default function IndexRoute() {
  const extra = (Constants.expoConfig?.extra ?? {}) as RuntimeExtra;

  return (
    <HealthScreen
      build={extra.build ?? "local"}
      environment={extra.environment ?? "development"}
      version={Constants.expoConfig?.version ?? "0.1.0"}
    />
  );
}

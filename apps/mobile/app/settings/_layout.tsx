import { Stack } from "expo-router";

import { ShellRouteGate } from "../../src/features/shell/ui/ShellRouteGate";

export default function SettingsLayout() {
  return <ShellRouteGate><Stack screenOptions={{ headerShown: false }} /></ShellRouteGate>;
}

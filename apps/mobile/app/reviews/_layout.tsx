import { Stack } from "expo-router";

import { ShellRouteGate } from "../../src/features/shell/ui/ShellRouteGate";

export default function ReviewsLayout() {
  return <ShellRouteGate><Stack screenOptions={{ headerShown: false }} /></ShellRouteGate>;
}

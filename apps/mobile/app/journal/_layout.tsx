import { Stack } from "expo-router";
import { JournalRouteGate } from "../../src/features/journal/ui/JournalRouteGate";
import { ShellRouteGate } from "../../src/features/shell/ui/ShellRouteGate";
export default function JournalLayout() { return <ShellRouteGate><JournalRouteGate><Stack screenOptions={{ headerShown: false }} /></JournalRouteGate></ShellRouteGate>; }

import { Stack } from "expo-router";
import { JournalRouteGate } from "../../src/features/journal/ui/JournalRouteGate";
import { JournalAdultGate } from "../../src/features/shell/ui/JournalAdultGate";
export default function JournalLayout() { return <JournalAdultGate><JournalRouteGate><Stack screenOptions={{ headerShown: false }} /></JournalRouteGate></JournalAdultGate>; }

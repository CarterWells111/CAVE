import { Redirect, useLocalSearchParams } from "expo-router";

export default function AssistantRoute() {
  const { journeyId } = useLocalSearchParams<{ journeyId?: string }>();
  return <Redirect href={{ pathname: "/(tabs)/ai", ...(typeof journeyId === "string" ? { params: { journeyId } } : {}) }} />;
}

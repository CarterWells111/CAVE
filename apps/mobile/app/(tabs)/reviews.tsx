import { Redirect } from "expo-router";

// Compatibility for saved links; journal reviews live inside the journal now.
export default function ReviewsRoute() { return <Redirect href="/(tabs)/journal" />; }

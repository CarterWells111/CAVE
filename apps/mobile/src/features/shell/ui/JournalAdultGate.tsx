import { Redirect } from "expo-router";
import type { PropsWithChildren } from "react";
import { useAdultDeclaration } from "../../journey/runtime/JourneyRuntimeProvider";
export function JournalAdultGate({ children }: PropsWithChildren) {
  const declaration = useAdultDeclaration();
  if (declaration.status === "authorized") return children;
  return <Redirect href={{ pathname: "/journey/adult-gate", params: { entry: "journal" } }} />;
}

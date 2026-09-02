import { useState, type PropsWithChildren } from "react";
import { Pressable, Text } from "react-native";

import {
  JourneyStepBackProvider,
  type JourneyStepBackRegistration,
} from "./journey-step-back";

export function JourneyStepBackHarness({ children }: PropsWithChildren) {
  const [registration, setRegistration] = useState<JourneyStepBackRegistration | null>(null);
  return (
    <JourneyStepBackProvider setRegistration={setRegistration}>
      {children}
      {registration?.active ? (
        <Pressable
          accessibilityLabel="测试返回上一步"
          accessibilityRole="button"
          accessibilityState={{ disabled: registration.disabled }}
          disabled={registration.disabled}
          onPress={() => { void registration.onBack(); }}
        >
          <Text>测试返回上一步</Text>
        </Pressable>
      ) : null}
    </JourneyStepBackProvider>
  );
}

import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { useTheme } from "../../core/design/theme-provider";
import { Screen } from "../../core/ui/Screen";
import { Button } from "../../core/ui/Button";
import { SecondaryButton } from "../../core/ui/secondary-button";
import { useAdultDeclaration } from "../journey/runtime/JourneyRuntimeProvider";
import { useOptionalAuth } from "../auth/runtime/AuthProvider";
import { AssistantPanel } from "./AssistantPanel";

export function AssistantHub({ journeyId = "first-overnight" }: { journeyId?: string }) {
  const router = useRouter();
  const theme = useTheme();
  const adult = useAdultDeclaration();
  const auth = useOptionalAuth();
  return <Screen contentSafeAreaTop>
    <Text accessibilityRole="header" style={{ ...theme.typography.title, color: theme.color.text }}>AI</Text>
    <Text style={{ ...theme.typography.body, color: theme.color.textSecondary }}>陪你开始记录，整理想法，也解答旅程中的疑问。</Text>
    <View style={{ gap: theme.space.sm }}>
      <Button label="带我开始一条手记" onPress={() => router.push("/journal/new")} />
      <SecondaryButton label="选择手记进行回顾" onPress={() => router.push("/journal/review")} />
    </View>
    <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>整理和回顾时，由你选择记录并逐次确认。这里不会自动读取其他手记，也不会替你判断关系。</Text>
    {adult.status === "authorized" ? <>
      <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text }}>旅程问答 · 第一次过夜</Text>
      {auth?.status === "signedOut" ? <SecondaryButton label="登录以使用在线 AI" onPress={() => router.push({ pathname: "/auth/email", params: { returnTo: "/(tabs)/ai" } })} /> : null}
      <AssistantPanel records={[]} modes={["journey"]} journeyId={journeyId} />
    </> : <Button label="成年声明后开始问答" onPress={() => router.push({ pathname: "/journey/adult-gate", params: { entry: "ai" } })} />}
  </Screen>;
}

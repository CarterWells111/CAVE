import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function IndexRoute() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>内界 CAVE</Text>
      <Text>七屏本地旅程已准备好。</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/journey/welcome")}
        style={styles.button}
      >
        <Text>进入七屏体验</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    gap: 16,
    padding: 24
  },
  title: {
    fontSize: 28,
    fontWeight: "700"
  },
  button: {
    alignItems: "center",
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#E6E1FF"
  }
});

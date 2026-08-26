import { StyleSheet, Text, View } from "react-native";

export type HealthScreenProps = {
  build: string;
  environment: string;
  version: string;
};

export function HealthScreen({
  build,
  environment,
  version
}: HealthScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Body Voice</Text>
      <Text>version {version}</Text>
      <Text>build {build}</Text>
      <Text>{environment}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    gap: 8,
    justifyContent: "center",
    padding: 24
  },
  title: {
    fontSize: 28,
    fontWeight: "600"
  }
});

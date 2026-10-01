import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";
import type { View } from "react-native";

export async function saveRoomReportImage(view: View): Promise<"saved" | "permission-denied"> {
  const permission = await MediaLibrary.requestPermissionsAsync(true, ["photo"]);
  if (!permission.granted) return "permission-denied";
  const fileUri = await captureRef(view, { format: "png", quality: 1, result: "tmpfile" });
  await MediaLibrary.saveToLibraryAsync(fileUri);
  return "saved";
}

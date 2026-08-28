import * as MediaLibrary from "expo-media-library";
import { Linking } from "react-native";

export type CardImageSaveErrorCode =
  | "permission-denied"
  | "limited-access"
  | "permission-failed"
  | "write-failed";
export type CardImageSaveRecovery = "open-settings" | null;

export class CardImageSaveError extends Error {
  constructor(
    readonly code: CardImageSaveErrorCode,
    readonly recovery: CardImageSaveRecovery = null
  ) {
    super("无法将图片保存到本机相册。");
    this.name = "CardImageSaveError";
  }
}

export const cardImagePermissionRecovery = {
  openSettings: () => Linking.openSettings()
};

export async function saveCardImageToLibrary(fileUri: string): Promise<void> {
  let permission: MediaLibrary.PermissionResponse;
  try {
    permission = await MediaLibrary.requestPermissionsAsync(true, ["photo"]);
  } catch {
    throw new CardImageSaveError("permission-failed");
  }

  if (permission.accessPrivileges === "limited") {
    throw new CardImageSaveError("limited-access");
  }
  if (permission.status !== "granted") {
    throw new CardImageSaveError(
      "permission-denied",
      permission.canAskAgain === false ? "open-settings" : null
    );
  }

  try {
    await MediaLibrary.createAssetAsync(fileUri);
  } catch {
    throw new CardImageSaveError("write-failed");
  }
}
